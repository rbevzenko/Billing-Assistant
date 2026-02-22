import { load, save, nextId, nowISO, paginate } from './storage'
import { getRateToRub, CURRENCY_SYMBOL } from './exchange'
import { VAT_RATES as VAT_RATE_MAP } from '@/types'
import { TRANSLATIONS } from '@/i18n/translations'
import type {
  Currency, Invoice, InvoiceCreate, InvoiceItem, InvoiceStatus, InvoiceUpdate,
  LawyerProfile, AppLanguage, Page, Project, TimeEntry, VatType,
} from '@/types'

const KEY = 'invoices'

function generateInvoiceNumber(invoices: Invoice[]): string {
  const year = new Date().getFullYear()
  const count = invoices.filter(inv => inv.invoice_number.includes(String(year))).length + 1
  return `INV-${year}-${String(count).padStart(3, '0')}`
}

function calcVat(subtotal: number, vatType: VatType): number {
  const rate = VAT_RATE_MAP[vatType]
  return vatType === 'vat10' || vatType === 'vat20' ? subtotal * rate : 0
}

function printHtml(html: string) {
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }
}

function normalize(inv: Partial<Invoice>): Invoice {
  const subtotal = inv.subtotal ?? inv.total_amount ?? '0'
  return {
    profile_id: 1,
    currency: 'RUB',
    vat_type: 'none',
    subtotal,
    vat_amount: '0',
    ...inv,
    total_amount: inv.total_amount ?? subtotal,
  } as Invoice
}

export const invoicesService = {
  list: (params: {
    client_id?: number
    status?: InvoiceStatus
    date_from?: string
    date_to?: string
    page?: number
    size?: number
  }): Promise<Page<Invoice>> => {
    let items = load<Invoice>(KEY).map(normalize)
    if (params.client_id) items = items.filter(inv => inv.client_id === params.client_id)
    if (params.status) items = items.filter(inv => inv.status === params.status)
    if (params.date_from) items = items.filter(inv => inv.issue_date >= params.date_from!)
    if (params.date_to) items = items.filter(inv => inv.issue_date <= params.date_to!)
    items = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))
    return Promise.resolve(paginate(items, params.page ?? 1, params.size ?? 20))
  },

  get: (id: number): Promise<Invoice> => {
    const item = load<Invoice>(KEY).map(normalize).find(inv => inv.id === id)
    if (!item) return Promise.reject(new Error('Счёт не найден'))
    return Promise.resolve(item)
  },

  create: async (data: InvoiceCreate): Promise<Invoice> => {
    const invoices = load<Invoice>(KEY).map(normalize)
    const timeEntries = load<TimeEntry>('time_entries')
    const projects = load<Project>('projects')
    const profiles = load<LawyerProfile>('profiles')
    const profile = profiles.find(p => p.id === data.profile_id) ?? profiles[0]

    const currency: Currency = data.currency ?? profile?.default_currency ?? 'RUB'
    const vatType: VatType = data.vat_type ?? profile?.vat_type ?? 'none'
    const paymentCurrency: Currency | undefined = data.payment_currency

    const selectedEntries = timeEntries.filter(e => data.time_entry_ids.includes(e.id))
    const items: InvoiceItem[] = selectedEntries.map((entry, idx) => {
      const project = projects.find(p => p.id === entry.project_id)
      const rate = project?.hourly_rate ?? profile?.default_hourly_rate ?? '0'
      const hours = parseFloat(entry.duration_hours)
      const amount = (hours * parseFloat(rate)).toFixed(2)
      return {
        id: idx + 1,
        time_entry_id: entry.id,
        hours: entry.duration_hours,
        rate,
        amount,
        date: entry.date,
        project_name: project?.name ?? null,
        description: entry.description,
      }
    })

    const subtotalNum = items.reduce((s, i) => s + parseFloat(i.amount), 0)
    const vatNum = calcVat(subtotalNum, vatType)
    const totalNum = subtotalNum + vatNum

    let exchange_rate: number | undefined
    let payment_amount: string | undefined
    if (paymentCurrency && paymentCurrency !== currency) {
      try {
        const fromRub = await getRateToRub(currency)
        const toRub = await getRateToRub(paymentCurrency)
        exchange_rate = toRub / fromRub
        payment_amount = (totalNum * exchange_rate).toFixed(2)
      } catch {
        // continue without conversion
      }
    }

    const invoice: Invoice = {
      id: nextId(invoices),
      client_id: data.client_id,
      profile_id: data.profile_id,
      invoice_number: generateInvoiceNumber(invoices),
      issue_date: data.issue_date,
      due_date: data.due_date,
      status: 'draft',
      notes: data.notes ?? null,
      created_at: nowISO(),
      items,
      currency,
      vat_type: vatType,
      subtotal: subtotalNum.toFixed(2),
      vat_amount: vatNum.toFixed(2),
      total_amount: totalNum.toFixed(2),
      ...(paymentCurrency && exchange_rate !== undefined
        ? { payment_currency: paymentCurrency, exchange_rate, payment_amount }
        : {}),
    }

    const updatedEntries = timeEntries.map(e =>
      data.time_entry_ids.includes(e.id) ? { ...e, status: 'billed' as const, updated_at: nowISO() } : e
    )
    save('time_entries', updatedEntries)
    save(KEY, [...invoices, invoice])
    return invoice
  },

  update: (id: number, data: InvoiceUpdate): Promise<Invoice> => {
    const items = load<Invoice>(KEY).map(normalize)
    const idx = items.findIndex(inv => inv.id === id)
    if (idx === -1) return Promise.reject(new Error('Счёт не найден'))
    const updated: Invoice = { ...items[idx], ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) }
    items[idx] = updated
    save(KEY, items)
    return Promise.resolve(updated)
  },

  delete: (id: number): Promise<void> => {
    save(KEY, load<Invoice>(KEY).map(normalize).filter(inv => inv.id !== id))
    return Promise.resolve()
  },

  send: (id: number): Promise<Invoice> => {
    const items = load<Invoice>(KEY).map(normalize)
    const idx = items.findIndex(inv => inv.id === id)
    if (idx === -1) return Promise.reject(new Error('Счёт не найден'))
    items[idx] = { ...items[idx], status: 'sent' }
    save(KEY, items)
    return Promise.resolve(items[idx])
  },

  pay: (id: number): Promise<Invoice> => {
    const items = load<Invoice>(KEY).map(normalize)
    const idx = items.findIndex(inv => inv.id === id)
    if (idx === -1) return Promise.reject(new Error('Счёт не найден'))
    items[idx] = { ...items[idx], status: 'paid' }
    save(KEY, items)
    return Promise.resolve(items[idx])
  },

  downloadPdf: async (id: number, _invoiceNumber: string): Promise<void> => {
    const invoice = load<Invoice>(KEY).map(normalize).find(inv => inv.id === id)
    if (!invoice) return

    const profiles = load<LawyerProfile>('profiles')
    const profile = profiles.find(p => p.id === invoice.profile_id) ?? profiles[0] ?? null
    const client = load<{ id: number; name: string; inn?: string | null; address?: string | null; email?: string | null }>('clients')
      .find(c => c.id === invoice.client_id)

    const lang: AppLanguage = profile?.language ?? 'ru'
    const T = TRANSLATIONS[lang]
    const sym = CURRENCY_SYMBOL[invoice.currency]

    const fmtN = (n: number) =>
      n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const fmt = (amount: string | number) => `${fmtN(typeof amount === 'string' ? parseFloat(amount) : amount)} ${sym}`

    const showVat = invoice.vat_type === 'vat10' || invoice.vat_type === 'vat20'
    const vatLabel = T.vat[invoice.vat_type]

    const profileBank = (() => {
      if (!profile) return ''
      if (profile.type === 'eu') {
        return [
          profile.iban ? `${T.invoice.iban}: ${profile.iban}` : '',
          profile.swift ? `${T.invoice.swift}: ${profile.swift}` : '',
          profile.bank_country ? `${T.invoice.country}: ${profile.bank_country}` : '',
          profile.vat_number ? `${T.invoice.vatNumber}: ${profile.vat_number}` : '',
        ].filter(Boolean).map(s => `<p>${s}</p>`).join('')
      }
      return [
        profile.inn ? `${T.invoice.inn}: ${profile.inn}` : '',
        profile.bank_name ?? '',
        profile.bik ? `${T.invoice.bik}: ${profile.bik}` : '',
        profile.checking_account ? `${T.invoice.account}: ${profile.checking_account}` : '',
        profile.correspondent_account ? `${T.invoice.corrAccount}: ${profile.correspondent_account}` : '',
      ].filter(Boolean).map(s => `<p>${s}</p>`).join('')
    })()

    const html = `<!DOCTYPE html>
<html lang="${lang}"><head>
  <meta charset="utf-8">
  <title>${T.invoice.invoice} ${invoice.invoice_number}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#222;font-size:14px}
    h1{font-size:22px;margin:0 0 4px}
    .sub{color:#666;margin-bottom:24px;font-size:13px}
    .parties{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:28px}
    .party h3{font-size:11px;text-transform:uppercase;color:#999;margin:0 0 6px;letter-spacing:.05em}
    .party p{margin:2px 0;font-size:13px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    th{background:#f5f5f5;padding:10px;text-align:left;font-size:12px;border-bottom:2px solid #ddd}
    td{padding:10px;border-bottom:1px solid #eee;font-size:13px}
    .right{text-align:right}
    .vat-block{text-align:right;font-size:13px;margin-bottom:4px;color:#555}
    .total{text-align:right;font-size:20px;font-weight:700;margin-top:12px;padding-top:12px;border-top:2px solid #222}
    .payment-block{text-align:right;font-size:13px;margin-top:8px;color:#555}
    .vat-note{margin-top:12px;font-size:12px;color:#777;font-style:italic}
    .notes{color:#666;font-size:12px;margin-top:16px;border-top:1px solid #eee;padding-top:12px}
    @media print{body{padding:20px}}
  </style>
</head><body>
  <h1>${T.invoice.invoice} № ${invoice.invoice_number}</h1>
  <div class="sub">${T.invoice.issueDate}: ${invoice.issue_date} &nbsp;·&nbsp; ${T.invoice.dueDate}: ${invoice.due_date}</div>
  <div class="parties">
    <div class="party">
      <h3>${T.invoice.issuer}</h3>
      ${profile ? `
        <p><strong>${profile.company_name || profile.full_name}</strong></p>
        ${profile.company_name && profile.full_name ? `<p>${profile.full_name}</p>` : ''}
        ${profile.address ? `<p>${profile.address}</p>` : ''}
        ${profile.email ? `<p>${profile.email}</p>` : ''}
        ${profile.phone ? `<p>${profile.phone}</p>` : ''}
        ${profileBank}
      ` : `<p>${T.invoice.notFilled}</p>`}
    </div>
    <div class="party">
      <h3>${T.invoice.client}</h3>
      <p><strong>${client?.name ?? '—'}</strong></p>
      ${client?.inn ? `<p>${T.invoice.inn}: ${client.inn}</p>` : ''}
      ${client?.address ? `<p>${client.address}</p>` : ''}
      ${client?.email ? `<p>${client.email}</p>` : ''}
    </div>
  </div>
  <table>
    <thead><tr>
      <th>${T.invoice.date}</th>
      <th>${T.invoice.project} / ${T.invoice.description}</th>
      <th class="right">${T.invoice.hours}</th>
      <th class="right">${T.invoice.rate} (${sym}/h)</th>
      <th class="right">${T.invoice.amount} (${sym})</th>
    </tr></thead>
    <tbody>
      ${invoice.items.map(item => `<tr>
        <td>${item.date ?? '—'}</td>
        <td>${[item.project_name, item.description].filter(Boolean).join(' — ') || '—'}</td>
        <td class="right">${item.hours}</td>
        <td class="right">${fmtN(parseFloat(item.rate))}</td>
        <td class="right">${fmtN(parseFloat(item.amount))}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${showVat ? `
    <div class="vat-block">${T.invoice.subtotal}: ${fmt(invoice.subtotal)}</div>
    <div class="vat-block">${vatLabel}: ${fmt(invoice.vat_amount)}</div>
  ` : ''}
  <div class="total">${T.invoice.total}: ${fmt(invoice.total_amount)}</div>
  ${invoice.payment_currency && invoice.payment_amount && invoice.exchange_rate ? `
    <div class="payment-block">
      ${T.invoice.paymentTotal} ${invoice.payment_currency}:
      ${fmtN(parseFloat(invoice.payment_amount))} ${CURRENCY_SYMBOL[invoice.payment_currency]}
      (${T.invoice.atRate}: ${invoice.exchange_rate.toFixed(4)})
    </div>
  ` : ''}
  ${!showVat && invoice.vat_type !== 'none' ? `<div class="vat-note">${vatLabel}</div>` : ''}
  ${invoice.notes ? `<div class="notes">${T.invoice.notes}: ${invoice.notes}</div>` : ''}
</body></html>`

    printHtml(html)
  },
}
