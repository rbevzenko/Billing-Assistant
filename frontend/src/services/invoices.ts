import { supabase } from '@/lib/supabase'
import { getRate, CURRENCY_SYMBOL } from './exchange'
import { VAT_RATES as VAT_RATE_MAP } from '@/types'
import { TRANSLATIONS } from '@/i18n/translations'
import type {
  Currency, Invoice, InvoiceCreate, InvoiceItem, InvoiceStatus, InvoiceType, InvoiceUpdate,
  LawyerProfile, AppLanguage, Page, ProjectAdvanceBalance, VatType,
} from '@/types'

const TABLE = 'invoices'
const ITEMS_TABLE = 'invoice_items'

function paginate<T>(items: T[], total: number, page: number, size: number): Page<T> {
  return { items, total, page, size, pages: Math.ceil(total / size) || 1 }
}

function generateInvoiceNumber(year: number, count: number): string {
  return `INV-${year}-${String(count).padStart(3, '0')}`
}

function calcVat(subtotal: number, vatType: VatType): number {
  const rate = VAT_RATE_MAP[vatType]
  return vatType === 'vat10' || vatType === 'vat22' ? subtotal * rate : 0
}

function printHtml(html: string) {
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToInvoice(row: any, items: InvoiceItem[]): Invoice {
  const vat_type = (row.vat_type === 'vat20' ? 'vat22' : row.vat_type ?? 'none') as VatType
  return {
    id: row.id,
    client_id: row.client_id,
    profile_id: row.profile_id ?? 1,
    invoice_number: row.invoice_number,
    issue_date: row.issue_date,
    due_date: row.due_date,
    status: row.status,
    invoice_type: (row.invoice_type ?? 'standard') as InvoiceType,
    notes: row.notes,
    created_at: row.created_at,
    currency: row.currency ?? 'RUB',
    vat_type,
    subtotal: row.subtotal ?? '0',
    vat_amount: row.vat_amount ?? '0',
    total_amount: row.total_amount ?? '0',
    project_id: row.project_id ?? null,
    payment_currency: row.payment_currency,
    exchange_rate: row.exchange_rate,
    payment_amount: row.payment_amount,
    items,
  }
}

async function fetchItems(invoiceId: number): Promise<InvoiceItem[]> {
  const { data } = await supabase.from(ITEMS_TABLE).select('*').eq('invoice_id', invoiceId).order('id')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((item: any) => ({
    id: item.id,
    time_entry_id: item.time_entry_id,
    hours: item.hours,
    rate: item.rate,
    amount: item.amount,
    date: item.date,
    project_name: item.project_name,
    description: item.description,
    project_id: item.project_id ?? null,
  }))
}

export const invoicesService = {
  list: async (params: {
    client_id?: number
    status?: InvoiceStatus
    date_from?: string
    date_to?: string
    page?: number
    size?: number
  }): Promise<Page<Invoice>> => {
    const page = params.page ?? 1
    const size = params.size ?? 20
    const from = (page - 1) * size
    const to = from + size - 1

    let query = supabase.from(TABLE).select('*', { count: 'exact' })
    if (params.client_id) query = query.eq('client_id', params.client_id)
    if (params.status) query = query.eq('status', params.status)
    if (params.date_from) query = query.gte('issue_date', params.date_from)
    if (params.date_to) query = query.lte('issue_date', params.date_to)
    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, error, count } = await query
    if (error) throw error

    const invoices: Invoice[] = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data ?? []).map(async (row: any) => rowToInvoice(row, await fetchItems(row.id)))
    )
    return paginate(invoices, count ?? 0, page, size)
  },

  get: async (id: number): Promise<Invoice> => {
    const { data: row, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
    if (error) throw new Error('Счёт не найден')
    const items = await fetchItems(id)
    return rowToInvoice(row, items)
  },

  create: async (data: InvoiceCreate): Promise<Invoice> => {
    const year = new Date().getFullYear()
    const { data: existingInvoices } = await supabase
      .from(TABLE).select('invoice_number').ilike('invoice_number', `INV-${year}-%`)
    const count = (existingInvoices ?? []).length + 1

    const { data: profileRow } = await supabase
      .from('lawyer_profiles').select('*').eq('id', data.profile_id).single()
    const profile = profileRow as LawyerProfile | null
    const currency: Currency = data.currency ?? profile?.default_currency ?? 'RUB'
    const vatType: VatType = data.vat_type ?? profile?.vat_type ?? 'none'

    // ── Advance invoice ────────────────────────────────────────────────────────
    if (data.invoice_type === 'advance') {
      const advanceAmt = parseFloat(data.advance_amount ?? '0')
      const { data: projectRow } = await supabase
        .from('projects').select('name').eq('id', data.project_id).single()

      const advancePayCurrency: Currency | undefined = data.payment_currency
      let adv_exchange_rate: number | undefined
      let adv_payment_amount: string | undefined
      if (advancePayCurrency && advancePayCurrency !== currency) {
        try {
          adv_exchange_rate = await getRate(currency, advancePayCurrency)
          adv_payment_amount = (advanceAmt * adv_exchange_rate).toFixed(2)
        } catch { /* continue without conversion */ }
      }

      const invoicePayload = {
        client_id: data.client_id,
        profile_id: data.profile_id,
        invoice_number: generateInvoiceNumber(year, count),
        issue_date: data.issue_date,
        due_date: data.due_date,
        status: 'draft',
        notes: data.notes ?? null,
        currency,
        vat_type: vatType,
        subtotal: advanceAmt.toFixed(2),
        vat_amount: '0.00',
        total_amount: advanceAmt.toFixed(2),
        invoice_type: 'advance',
        project_id: data.project_id ?? null,
        ...(advancePayCurrency && adv_exchange_rate !== undefined
          ? { payment_currency: advancePayCurrency, exchange_rate: adv_exchange_rate, payment_amount: adv_payment_amount }
          : {}),
      }

      const { data: createdInvoice, error: invError } = await supabase
        .from(TABLE).insert(invoicePayload).select().single()
      if (invError) throw invError

      const advanceItem = {
        invoice_id: createdInvoice.id,
        time_entry_id: null,
        hours: '0',
        rate: '0',
        amount: advanceAmt.toFixed(2),
        date: data.issue_date,
        project_name: projectRow?.name ?? null,
        description: 'Авансовый платёж',
        project_id: null, // null so it doesn't count toward billed amount
      }

      const { data: createdItems } = await supabase
        .from(ITEMS_TABLE).insert([advanceItem]).select()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: InvoiceItem[] = (createdItems ?? []).map((item: any) => ({
        id: item.id, time_entry_id: null, hours: item.hours, rate: item.rate,
        amount: item.amount, date: item.date, project_name: item.project_name,
        description: item.description, project_id: null,
      }))
      return rowToInvoice(createdInvoice, items)
    }

    // ── Standard invoice ───────────────────────────────────────────────────────
    const entryIds = data.time_entry_ids ?? []
    const [{ data: timeEntriesRows }, { data: projectsRows }] = await Promise.all([
      supabase.from('time_entries').select('*').in('id', entryIds),
      supabase.from('projects').select('*'),
    ])

    const selectedEntries = (timeEntriesRows ?? []).filter(e => entryIds.includes(e.id))
    const itemsData = selectedEntries.map(entry => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const project = (projectsRows ?? [] as any[]).find((p: any) => p.id === entry.project_id)
      const rate = project?.hourly_rate ?? profile?.default_hourly_rate ?? '0'
      const hours = parseFloat(entry.duration_hours)
      const amount = (hours * parseFloat(rate)).toFixed(2)
      return {
        time_entry_id: entry.id,
        hours: entry.duration_hours,
        rate,
        amount,
        date: entry.date,
        project_name: project?.name ?? null,
        description: entry.description,
        project_id: project?.id ?? null,
      }
    })

    const subtotalNum = itemsData.reduce((s, i) => s + parseFloat(i.amount), 0)
    const vatNum = calcVat(subtotalNum, vatType)
    const totalNum = subtotalNum + vatNum
    const paymentCurrency: Currency | undefined = data.payment_currency

    let exchange_rate: number | undefined
    let payment_amount: string | undefined
    if (paymentCurrency && paymentCurrency !== currency) {
      try {
        exchange_rate = await getRate(currency, paymentCurrency)
        payment_amount = (totalNum * exchange_rate).toFixed(2)
      } catch { /* continue without conversion */ }
    }

    const invoicePayload = {
      client_id: data.client_id,
      profile_id: data.profile_id,
      invoice_number: generateInvoiceNumber(year, count),
      issue_date: data.issue_date,
      due_date: data.due_date,
      status: 'draft',
      notes: data.notes ?? null,
      currency,
      vat_type: vatType,
      subtotal: subtotalNum.toFixed(2),
      vat_amount: vatNum.toFixed(2),
      total_amount: totalNum.toFixed(2),
      invoice_type: 'standard',
      ...(paymentCurrency && exchange_rate !== undefined
        ? { payment_currency: paymentCurrency, exchange_rate, payment_amount }
        : {}),
    }

    const { data: createdInvoice, error: invError } = await supabase
      .from(TABLE).insert(invoicePayload).select().single()
    if (invError) throw invError

    const invoiceId = createdInvoice.id
    const { data: createdItems } = await supabase
      .from(ITEMS_TABLE)
      .insert(itemsData.map(item => ({ ...item, invoice_id: invoiceId })))
      .select()

    if (entryIds.length > 0) {
      await supabase
        .from('time_entries')
        .update({ status: 'billed', updated_at: new Date().toISOString() })
        .in('id', entryIds)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: InvoiceItem[] = (createdItems ?? []).map((item: any) => ({
      id: item.id, time_entry_id: item.time_entry_id, hours: item.hours,
      rate: item.rate, amount: item.amount, date: item.date,
      project_name: item.project_name, description: item.description,
      project_id: item.project_id ?? null,
    }))

    return rowToInvoice(createdInvoice, items)
  },

  update: async (id: number, data: InvoiceUpdate): Promise<Invoice> => {
    const { data: updated, error } = await supabase.from(TABLE).update(data).eq('id', id).select().single()
    if (error) throw new Error('Счёт не найден')
    const items = await fetchItems(id)
    return rowToInvoice(updated, items)
  },

  delete: async (id: number): Promise<void> => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
  },

  send: async (id: number): Promise<Invoice> => {
    const { data: updated, error } = await supabase.from(TABLE).update({ status: 'sent' }).eq('id', id).select().single()
    if (error) throw new Error('Счёт не найден')
    return rowToInvoice(updated, await fetchItems(id))
  },

  pay: async (id: number): Promise<Invoice> => {
    const { data: updated, error } = await supabase.from(TABLE).update({ status: 'paid' }).eq('id', id).select().single()
    if (error) throw new Error('Счёт не найден')
    return rowToInvoice(updated, await fetchItems(id))
  },

  getProjectAdvanceBalances: async (
    projectIds: number[]
  ): Promise<Record<number, ProjectAdvanceBalance>> => {
    if (projectIds.length === 0) return {}
    const [{ data: advances }, { data: billedItems }] = await Promise.all([
      supabase
        .from(TABLE)
        .select('project_id, total_amount')
        .in('project_id', projectIds)
        .eq('invoice_type', 'advance')
        .eq('status', 'paid'),
      supabase
        .from(ITEMS_TABLE)
        .select('project_id, amount')
        .in('project_id', projectIds),
    ])
    const result: Record<number, ProjectAdvanceBalance> = {}
    for (const id of projectIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paid = (advances ?? [] as any[]).filter((a: any) => a.project_id === id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce((s: number, a: any) => s + parseFloat(a.total_amount ?? '0'), 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const billed = (billedItems ?? [] as any[]).filter((i: any) => i.project_id === id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce((s: number, i: any) => s + parseFloat(i.amount ?? '0'), 0)
      if (paid > 0 || billed > 0) {
        result[id] = { paid, billed, balance: paid - billed }
      }
    }
    return result
  },

  downloadPdf: async (id: number, _invoiceNumber: string): Promise<void> => {
    const invoice = await invoicesService.get(id)
    if (!invoice) return

    const [{ data: profileRow }, { data: clientRow }] = await Promise.all([
      supabase.from('lawyer_profiles').select('*').eq('id', invoice.profile_id).single(),
      supabase.from('clients').select('id, name, inn, address, email').eq('id', invoice.client_id).single(),
    ])

    const profile = profileRow as LawyerProfile | null
    const client = clientRow as { id: number; name: string; inn?: string | null; address?: string | null; email?: string | null } | null

    const lang: AppLanguage = profile?.language ?? 'ru'
    const T = TRANSLATIONS[lang]
    const sym = CURRENCY_SYMBOL[invoice.currency]

    const fmtN = (n: number) =>
      n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const fmt = (amount: string | number) => `${fmtN(typeof amount === 'string' ? parseFloat(amount) : amount)} ${sym}`

    const showVat = invoice.vat_type === 'vat10' || invoice.vat_type === 'vat22'
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

    const isAdvance = invoice.invoice_type === 'advance'
    const advanceLabel = lang === 'ru' ? 'Авансовый платёж' : 'Advance Payment'
    const projectName = invoice.items[0]?.project_name ?? ''

    const itemsHtml = isAdvance
      ? `<table>
    <thead><tr>
      <th>${T.invoice.description}</th>
      <th class="right">${T.invoice.amount} (${sym})</th>
    </tr></thead>
    <tbody>
      <tr>
        <td>${advanceLabel}${projectName ? ` — ${projectName}` : ''}</td>
        <td class="right">${fmtN(parseFloat(invoice.total_amount))}</td>
      </tr>
    </tbody>
  </table>`
      : `<table>
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
  </table>`

    const html = `<!DOCTYPE html>
<html lang="${lang}"><head>
  <meta charset="utf-8">
  <title>${T.invoice.invoice} ${invoice.invoice_number}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#222;font-size:14px}
    h1{font-size:22px;margin:0 0 4px}
    .sub{color:#666;margin-bottom:24px;font-size:13px}
    .advance-badge{display:inline-block;background:#cffafe;color:#0e7490;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600;margin-left:8px;vertical-align:middle}
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
    .signature-block{margin-top:48px;display:flex;justify-content:flex-end}
    .signature-line{text-align:center}
    .signature-underline{border-top:1px solid #222;width:220px;margin:0 auto}
    .signature-name{font-size:12px;color:#555;margin-top:6px}
    @media print{body{padding:20px}}
  </style>
</head><body>
  <h1>${T.invoice.invoice} № ${invoice.invoice_number}${isAdvance ? `<span class="advance-badge">${advanceLabel}</span>` : ''}</h1>
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
  ${itemsHtml}
  ${!isAdvance && showVat ? `
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
  ${!isAdvance && !showVat && invoice.vat_type !== 'none' ? `<div class="vat-note">${vatLabel}</div>` : ''}
  ${invoice.notes ? `<div class="notes">${T.invoice.notes}: ${invoice.notes}</div>` : ''}
  ${profile?.full_name ? `
  <div class="signature-block">
    <div class="signature-line">
      <div class="signature-underline"></div>
      <div class="signature-name">${profile.full_name}</div>
    </div>
  </div>` : ''}
</body></html>`

    printHtml(html)
  },
}
