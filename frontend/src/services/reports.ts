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

    const allEntries = load<TimeEntry>('time_entries')
    const projects = load<Project>('projects')
    const storedProfiles = load<LawyerProfile>('profiles')
    const activeId = localStorage.getItem('billing_active_profile_id')
    const profile = (activeId ? storedProfiles.find(p => p.id === Number(activeId)) : null)
      ?? storedProfiles[0] ?? null

    let entries = allEntries.filter(
      e => e.date >= params.date_from && e.date <= params.date_to
    )
    if (params.client_id) {
      const ids = new Set(projects.filter(p => p.client_id === params.client_id).map(p => p.id))
      entries = entries.filter(e => ids.has(e.project_id))
    }
    entries.sort((a, b) => a.date.localeCompare(b.date))

    const fmtAmt = (n: number, cur = '₽') =>
      n.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) + '\u00a0' + cur

    const clientRowsHtml = data.breakdown.map(c => {
      const projRowsHtml = c.projects.map(proj => {
        const project = projects.find(p => p.id === proj.project_id)
        const rate = parseFloat(project?.hourly_rate ?? profile?.default_hourly_rate ?? '0')
        const cur = project?.currency ?? 'RUB'
        const curSym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '₽'

        const projEntries = entries.filter(e => e.project_id === proj.project_id)
        const entryRowsHtml = projEntries.map(e => {
          const h = parseFloat(e.duration_hours)
          const amt = h * rate
          return `<tr class="entry-row">
            <td class="td-date">${e.date}</td>
            <td class="td-desc">${e.description ?? '—'}</td>
            <td class="td-num">${h.toFixed(2)}</td>
            <td class="td-num">${rate > 0 ? fmtAmt(amt, curSym) : '—'}</td>
          </tr>`
        }).join('')

        return `<tr class="proj-hdr">
          <td colspan="4">${proj.project_name}&nbsp;<span style="font-weight:400;color:#777">(${proj.entries_count}\u00a0зап.)</span></td>
        </tr>
        ${entryRowsHtml}
        <tr class="proj-total">
          <td colspan="2" class="td-right">Итого по проекту:</td>
          <td class="td-num">${proj.hours.toFixed(2)}\u00a0ч</td>
          <td class="td-num">${rate > 0 ? fmtAmt(proj.amount, curSym) : '—'}</td>
        </tr>`
      }).join('')

      return `<tr class="client-hdr">
        <td colspan="4">${c.client_name}</td>
      </tr>
      ${projRowsHtml}
      <tr class="client-total">
        <td colspan="2" class="td-right">Итого по клиенту:</td>
        <td class="td-num">${c.hours.toFixed(2)}\u00a0ч</td>
        <td class="td-num">${fmtAmt(c.amount)}</td>
      </tr>`
    }).join('')

    const sigName = profile?.full_name ?? ''

    const html = `<!DOCTYPE html>
<html lang="ru"><head>
  <meta charset="utf-8">
  <title>Отчёт ${params.date_from} — ${params.date_to}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#222;font-size:13px}
    h1{font-size:20px;margin:0 0 4px}
    .sub{color:#666;margin-bottom:6px}
    .lawyer{color:#444;font-size:12px;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;margin-bottom:24px}
    th{background:#f0f0f0;padding:8px;text-align:left;font-size:12px;border-bottom:2px solid #ccc}
    td{padding:5px 8px;border-bottom:1px solid #eee;font-size:12px}
    .td-num{text-align:right;white-space:nowrap}
    .td-right{text-align:right;color:#666}
    .td-date{color:#555;width:88px}
    .td-desc{color:#333}
    .client-hdr td{background:#dbeafe;font-weight:700;font-size:14px;padding:8px}
    .proj-hdr td{background:#f3f4f6;font-weight:600;font-size:12px;color:#374151;padding:6px 8px}
    .proj-total td{background:#f9fafb;font-size:12px}
    .client-total td{background:#dbeafe;font-weight:600;font-size:12px}
    .entry-row td{font-size:12px}
    .summary{display:flex;gap:16px;margin-bottom:24px}
    .box{border:1px solid #ddd;border-radius:6px;padding:12px;flex:1}
    .box-label{font-size:11px;color:#999;margin-bottom:4px}
    .box-value{font-size:18px;font-weight:700}
    .grand-total{text-align:right;font-size:16px;font-weight:700;margin-bottom:32px}
    .sig-block{margin-top:48px;display:flex;justify-content:flex-end}
    .sig-line{text-align:center}
    .sig-underline{border-top:1px solid #222;width:220px;margin:0 auto}
    .sig-name{font-size:12px;color:#555;margin-top:6px}
    @media print{body{padding:20px}}
  </style>
</head><body>
  <h1>Отчёт по работе</h1>
  <div class="sub">${params.date_from} — ${params.date_to}</div>
  ${sigName ? `<div class="lawyer">${sigName}</div>` : ''}
  <div class="summary">
    <div class="box"><div class="box-label">Всего часов</div><div class="box-value">${data.total_hours.toFixed(2)}</div></div>
    <div class="box"><div class="box-label">Сумма (руб.)</div><div class="box-value">${fmtAmt(data.total_amount)}</div></div>
    <div class="box"><div class="box-label">Счетов выставлено</div><div class="box-value">${data.invoice_summary.count_total}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Дата</th><th>Описание работы</th>
      <th style="text-align:right">Часы</th><th style="text-align:right">Сумма</th>
    </tr></thead>
    <tbody>${clientRowsHtml}</tbody>
  </table>
  <div class="grand-total">Итого: ${data.total_hours.toFixed(2)}&nbsp;ч &nbsp;|&nbsp; ${fmtAmt(data.total_amount)}</div>
  ${sigName ? `<div class="sig-block">
    <div class="sig-line">
      <div class="sig-underline"></div>
      <div class="sig-name">${sigName}</div>
    </div>
  </div>` : ''}
</body></html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      setTimeout(() => win.print(), 300)
    }
  },
}
