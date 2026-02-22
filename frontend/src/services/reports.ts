import { load, loadOne } from './storage'
import type {
  Client, ClientBreakdown, Invoice, InvoiceSummary, LawyerProfile,
  Project, ProjectBreakdown, ReportData, TimeEntry,
} from '@/types'

export interface ReportParams {
  date_from: string
  date_to: string
  client_id?: number | null
}

export const reportsService = {
  get: (params: ReportParams): Promise<ReportData> => {
    const allEntries = load<TimeEntry>('time_entries')
    const allInvoices = load<Invoice>('invoices')
    const projects = load<Project>('projects')
    const clients = load<Client>('clients')
    const profile = loadOne<LawyerProfile>('profile')

    let entries = allEntries.filter(
      e => e.date >= params.date_from && e.date <= params.date_to
    )
    let invoices = allInvoices.filter(
      inv => inv.issue_date >= params.date_from && inv.issue_date <= params.date_to
    )

    if (params.client_id) {
      const clientProjectIds = new Set(
        projects.filter(p => p.client_id === params.client_id).map(p => p.id)
      )
      entries = entries.filter(e => clientProjectIds.has(e.project_id))
      invoices = invoices.filter(inv => inv.client_id === params.client_id)
    }

    // Group entries by client → project
    const clientMap = new Map<number, Map<number, { hours: number; amount: number; count: number }>>()
    for (const e of entries) {
      const project = projects.find(p => p.id === e.project_id)
      if (!project) continue
      const rate = parseFloat(project.hourly_rate ?? profile?.default_hourly_rate ?? '0')
      const hours = parseFloat(e.duration_hours)
      const amount = hours * rate
      if (!clientMap.has(project.client_id)) clientMap.set(project.client_id, new Map())
      const projMap = clientMap.get(project.client_id)!
      const existing = projMap.get(project.id) ?? { hours: 0, amount: 0, count: 0 }
      projMap.set(project.id, { hours: existing.hours + hours, amount: existing.amount + amount, count: existing.count + 1 })
    }

    const breakdown: ClientBreakdown[] = []
    for (const [clientId, projMap] of clientMap.entries()) {
      const client = clients.find(c => c.id === clientId)
      const projectBreakdowns: ProjectBreakdown[] = []
      let clientHours = 0
      let clientAmount = 0
      for (const [projectId, stats] of projMap.entries()) {
        const project = projects.find(p => p.id === projectId)
        projectBreakdowns.push({
          project_id: projectId,
          project_name: project?.name ?? '—',
          entries_count: stats.count,
          hours: stats.hours,
          amount: stats.amount,
        })
        clientHours += stats.hours
        clientAmount += stats.amount
      }
      breakdown.push({
        client_id: clientId,
        client_name: client?.name ?? '—',
        hours: clientHours,
        amount: clientAmount,
        projects: projectBreakdowns,
      })
    }

    const total_hours = breakdown.reduce((s, c) => s + c.hours, 0)
    const total_amount = breakdown.reduce((s, c) => s + c.amount, 0)

    const invoice_summary: InvoiceSummary = {
      count_total: invoices.length,
      count_paid: invoices.filter(i => i.status === 'paid').length,
      count_unpaid: invoices.filter(i => i.status !== 'paid').length,
      count_overdue: invoices.filter(i => i.status === 'overdue').length,
      total_invoiced: invoices.reduce((s, i) => s + parseFloat(i.total_amount), 0),
      total_paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.total_amount), 0),
      total_unpaid: invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + parseFloat(i.total_amount), 0),
    }

    return Promise.resolve({
      date_from: params.date_from,
      date_to: params.date_to,
      client_id: params.client_id ?? null,
      total_hours,
      total_amount,
      breakdown,
      invoice_summary,
    })
  },

  downloadPdf: async (params: ReportParams): Promise<void> => {
    const data = await reportsService.get(params)
    const fmt = (n: number) =>
      n.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) + ' руб.'

    const breakdownRows = data.breakdown.flatMap(c => [
      `<tr style="background:#f5f5f5;font-weight:600">
        <td colspan="3">${c.client_name}</td>
        <td style="text-align:right">${c.hours.toFixed(2)}</td>
        <td style="text-align:right">${fmt(c.amount)}</td>
      </tr>`,
      ...c.projects.map(p => `<tr>
        <td></td>
        <td colspan="2">${p.project_name} (${p.entries_count} зап.)</td>
        <td style="text-align:right">${p.hours.toFixed(2)}</td>
        <td style="text-align:right">${fmt(p.amount)}</td>
      </tr>`),
    ]).join('')

    const html = `<!DOCTYPE html>
<html lang="ru"><head>
  <meta charset="utf-8">
  <title>Отчёт ${params.date_from} — ${params.date_to}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#222;font-size:13px}
    h1{font-size:20px;margin:0 0 4px}
    .sub{color:#666;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;margin-bottom:24px}
    th{background:#f0f0f0;padding:8px;text-align:left;font-size:12px;border-bottom:2px solid #ccc}
    td{padding:8px;border-bottom:1px solid #eee}
    .total{text-align:right;font-size:16px;font-weight:700;margin-bottom:24px}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
    .box{border:1px solid #ddd;border-radius:6px;padding:12px}
    .box-label{font-size:11px;color:#999;margin-bottom:4px}
    .box-value{font-size:18px;font-weight:700}
    @media print{body{padding:20px}}
  </style>
</head><body>
  <h1>Отчёт по работе</h1>
  <div class="sub">${params.date_from} — ${params.date_to}</div>
  <div class="summary">
    <div class="box"><div class="box-label">Всего часов</div><div class="box-value">${data.total_hours.toFixed(2)}</div></div>
    <div class="box"><div class="box-label">Сумма</div><div class="box-value">${fmt(data.total_amount)}</div></div>
    <div class="box"><div class="box-label">Счетов выставлено</div><div class="box-value">${data.invoice_summary.count_total}</div></div>
  </div>
  <table>
    <thead><tr>
      <th></th><th colspan="2">Клиент / Проект</th>
      <th style="text-align:right">Часы</th><th style="text-align:right">Сумма</th>
    </tr></thead>
    <tbody>${breakdownRows}</tbody>
  </table>
  <div class="total">Итого: ${fmt(data.total_amount)}</div>
</body></html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      setTimeout(() => win.print(), 300)
    }
  },
}
