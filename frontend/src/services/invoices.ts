import { load, loadOne, save, nextId, nowISO, paginate } from './storage'
import type {
  Invoice, InvoiceCreate, InvoiceItem, InvoiceStatus, InvoiceUpdate, Page,
  LawyerProfile, Project, TimeEntry,
} from '@/types'

const KEY = 'invoices'

function generateInvoiceNumber(invoices: Invoice[]): string {
  const year = new Date().getFullYear()
  const count = invoices.filter(inv => inv.invoice_number.includes(String(year))).length + 1
  return `INV-${year}-${String(count).padStart(3, '0')}`
}

function printHtml(html: string) {
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }
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
    let items = load<Invoice>(KEY)
    if (params.client_id) items = items.filter(inv => inv.client_id === params.client_id)
    if (params.status) items = items.filter(inv => inv.status === params.status)
    if (params.date_from) items = items.filter(inv => inv.issue_date >= params.date_from!)
    if (params.date_to) items = items.filter(inv => inv.issue_date <= params.date_to!)
    items = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))
    return Promise.resolve(paginate(items, params.page ?? 1, params.size ?? 20))
  },

  get: (id: number): Promise<Invoice> => {
    const item = load<Invoice>(KEY).find(inv => inv.id === id)
    if (!item) return Promise.reject(new Error('Счёт не найден'))
    return Promise.resolve(item)
  },

  create: (data: InvoiceCreate): Promise<Invoice> => {
    const invoices = load<Invoice>(KEY)
    const timeEntries = load<TimeEntry>('time_entries')
    const projects = load<Project>('projects')
    const profile = loadOne<LawyerProfile>('profile')

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

    const total_amount = items.reduce((s, i) => s + parseFloat(i.amount), 0).toFixed(2)
    const invoice: Invoice = {
      id: nextId(invoices),
      client_id: data.client_id,
      invoice_number: generateInvoiceNumber(invoices),
      issue_date: data.issue_date,
      due_date: data.due_date,
      status: 'draft',
      notes: data.notes ?? null,
      created_at: nowISO(),
      items,
      total_amount,
    }

    // Mark time entries as billed
    const updatedEntries = timeEntries.map(e =>
      data.time_entry_ids.includes(e.id) ? { ...e, status: 'billed' as const, updated_at: nowISO() } : e
    )
    save('time_entries', updatedEntries)
    save(KEY, [...invoices, invoice])
    return Promise.resolve(invoice)
  },

  update: (id: number, data: InvoiceUpdate): Promise<Invoice> => {
    const items = load<Invoice>(KEY)
    const idx = items.findIndex(inv => inv.id === id)
    if (idx === -1) return Promise.reject(new Error('Счёт не найден'))
    const updated: Invoice = { ...items[idx], ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) }
    items[idx] = updated
    save(KEY, items)
    return Promise.resolve(updated)
  },

  delete: (id: number): Promise<void> => {
    save(KEY, load<Invoice>(KEY).filter(inv => inv.id !== id))
    return Promise.resolve()
  },

  send: (id: number): Promise<Invoice> => {
    const items = load<Invoice>(KEY)
    const idx = items.findIndex(inv => inv.id === id)
    if (idx === -1) return Promise.reject(new Error('Счёт не найден'))
    items[idx] = { ...items[idx], status: 'sent' }
    save(KEY, items)
    return Promise.resolve(items[idx])
  },

  pay: (id: number): Promise<Invoice> => {
    const items = load<Invoice>(KEY)
    const idx = items.findIndex(inv => inv.id === id)
    if (idx === -1) return Promise.reject(new Error('Счёт не найден'))
    items[idx] = { ...items[idx], status: 'paid' }
    save(KEY, items)
    return Promise.resolve(items[idx])
  },

  downloadPdf: async (id: number, _invoiceNumber: string): Promise<void> => {
    const invoice = load<Invoice>(KEY).find(inv => inv.id === id)
    if (!invoice) return
    const profile = loadOne<LawyerProfile>('profile')
    const client = load<{ id: number; name: string; inn: string | null }>('clients').find(c => c.id === invoice.client_id)

    const fmt = (amount: string) =>
      `${parseFloat(amount).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} руб.`

    const html = `<!DOCTYPE html>
<html lang="ru"><head>
  <meta charset="utf-8">
  <title>Счёт ${invoice.invoice_number}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#222;font-size:14px}
    h1{font-size:22px;margin:0 0 4px}
    .sub{color:#666;margin-bottom:24px}
    .parties{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:28px}
    .party h3{font-size:11px;text-transform:uppercase;color:#999;margin:0 0 6px}
    .party p{margin:2px 0}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{background:#f5f5f5;padding:10px;text-align:left;font-size:12px;border-bottom:2px solid #ddd}
    td{padding:10px;border-bottom:1px solid #eee;font-size:13px}
    .right{text-align:right}
    .total{text-align:right;font-size:18px;font-weight:700;margin-top:12px}
    .notes{color:#666;font-size:12px;margin-top:16px;border-top:1px solid #eee;padding-top:12px}
    @media print{body{padding:20px}}
  </style>
</head><body>
  <h1>Счёт № ${invoice.invoice_number}</h1>
  <div class="sub">Дата: ${invoice.issue_date} &nbsp;·&nbsp; Оплатить до: ${invoice.due_date}</div>
  <div class="parties">
    <div class="party">
      <h3>Исполнитель</h3>
      <p><strong>${profile?.full_name ?? '—'}</strong></p>
      ${profile?.company_name ? `<p>${profile.company_name}</p>` : ''}
      ${profile?.inn ? `<p>ИНН: ${profile.inn}</p>` : ''}
      ${profile?.bank_name ? `<p>${profile.bank_name}</p>` : ''}
      ${profile?.bik ? `<p>БИК: ${profile.bik}</p>` : ''}
      ${profile?.checking_account ? `<p>р/с: ${profile.checking_account}</p>` : ''}
      ${profile?.correspondent_account ? `<p>к/с: ${profile.correspondent_account}</p>` : ''}
    </div>
    <div class="party">
      <h3>Клиент</h3>
      <p><strong>${client?.name ?? '—'}</strong></p>
      ${client?.inn ? `<p>ИНН: ${client.inn}</p>` : ''}
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Дата</th><th>Проект / описание</th>
      <th class="right">Часов</th><th class="right">Ставка</th><th class="right">Сумма</th>
    </tr></thead>
    <tbody>
      ${invoice.items.map(item => `<tr>
        <td>${item.date ?? '—'}</td>
        <td>${[item.project_name, item.description].filter(Boolean).join(' — ') || '—'}</td>
        <td class="right">${item.hours}</td>
        <td class="right">${fmt(item.rate)}/ч</td>
        <td class="right">${fmt(item.amount)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="total">Итого: ${fmt(invoice.total_amount)}</div>
  ${invoice.notes ? `<div class="notes">Примечания: ${invoice.notes}</div>` : ''}
</body></html>`

    printHtml(html)
  },
}
