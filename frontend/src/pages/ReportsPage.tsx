import { useEffect, useState } from 'react'
import { reportsService } from '@/services/reports'
import { clientsService } from '@/services/clients'
import { useLanguage } from '@/i18n/translations'
import { CURRENCY_SYMBOL } from '@/services/exchange'
import type { Client, Currency, ReportData } from '@/types'

// ── Date helpers ───────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function firstOfLastMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

function lastOfLastMonth(): string {
  const d = new Date()
  d.setDate(0)
  return d.toISOString().slice(0, 10)
}

function firstOfQuarter(): string {
  const d = new Date()
  const q = Math.floor(d.getMonth() / 3)
  return `${d.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`
}

function firstOfYear(): string {
  return `${new Date().getFullYear()}-01-01`
}

type Preset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom'

function presetDates(preset: Preset): { from: string; to: string } {
  switch (preset) {
    case 'this_month':   return { from: firstOfMonth(), to: todayStr() }
    case 'last_month':   return { from: firstOfLastMonth(), to: lastOfLastMonth() }
    case 'this_quarter': return { from: firstOfQuarter(), to: todayStr() }
    case 'this_year':    return { from: firstOfYear(), to: todayStr() }
    default:             return { from: firstOfMonth(), to: todayStr() }
  }
}

// ── Formatting ─────────────────────────────────────────────────────────────────

function fmtHours(n: number): string {
  return n.toFixed(1)
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { lang, t } = useLanguage()

  const PRESETS: { id: Preset; label: string }[] = [
    { id: 'this_month', label: t.reports.thisMonth },
    { id: 'last_month', label: t.reports.lastMonth },
    { id: 'this_quarter', label: t.reports.thisQuarter },
    { id: 'this_year', label: t.reports.thisYear },
    { id: 'custom', label: t.reports.custom },
  ]

  const locale = lang === 'en' ? 'en-US' : 'ru-RU'

  function fmtMoney(n: number): string {
    return n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  function fmtAmounts(amounts: Record<string, number>): string {
    return Object.entries(amounts)
      .filter(([, v]) => v > 0)
      .map(([cur, v]) => `${fmtMoney(v)} ${CURRENCY_SYMBOL[cur as Currency] ?? cur}`)
      .join(' / ')
  }

  const [clients, setClients] = useState<Client[]>([])
  const [preset, setPreset] = useState<Preset>('this_month')
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(todayStr())
  const [clientId, setClientId] = useState<number | null>(null)
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    clientsService.list({}).then(p => setClients(p.items))
  }, [])

  function handlePresetChange(p: Preset) {
    setPreset(p)
    if (p !== 'custom') {
      const { from, to } = presetDates(p)
      setDateFrom(from)
      setDateTo(to)
    }
  }

  function handleLoad() {
    setLoading(true)
    setReport(null)
    reportsService
      .get({ date_from: dateFrom, date_to: dateTo, client_id: clientId })
      .then(r => {
        setReport(r)
        setExpanded(new Set(r.breakdown.map(c => c.client_id)))
      })
      .finally(() => setLoading(false))
  }

  function handlePdf() {
    setPdfLoading(true)
    reportsService
      .downloadPdf({ date_from: dateFrom, date_to: dateTo, client_id: clientId })
      .finally(() => setPdfLoading(false))
  }

  function toggleClient(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const hoursUnit = lang === 'en' ? 'h' : 'ч'

  return (
    <div>
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="card report-filters-card">
        <div className="card-header">
          <h2 className="card-title">{t.reports.title}</h2>
        </div>

        {/* Preset buttons */}
        <div className="report-presets">
          {PRESETS.map(p => (
            <button
              key={p.id}
              className={`btn btn-sm ${preset === p.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handlePresetChange(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date + client row */}
        <div className="report-filter-row">
          <div className="form-group">
            <label className="form-label">{t.reports.periodStart}</label>
            <input
              type="date"
              className="form-control"
              value={dateFrom}
              onChange={e => { setPreset('custom'); setDateFrom(e.target.value) }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t.reports.periodEnd}</label>
            <input
              type="date"
              className="form-control"
              value={dateTo}
              onChange={e => { setPreset('custom'); setDateTo(e.target.value) }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t.common.client}</label>
            <select
              className="form-control"
              value={clientId ?? ''}
              onChange={e => setClientId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t.common.allClients}</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="report-filter-actions">
            <button className="btn btn-primary" onClick={handleLoad} disabled={loading}>
              {loading ? t.reports.generating : t.reports.generate}
            </button>
            {report && (
              <button className="btn btn-outline" onClick={handlePdf} disabled={pdfLoading}>
                {pdfLoading ? t.reports.pdfGenerating : t.reports.pdf}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {report && (
        <>
          {/* Summary cards */}
          <div className="dashboard-grid" style={{ marginTop: 20 }}>
            <div className="stat-card">
              <div className="stat-label">{t.reports.totalHours}</div>
              <div className="stat-value">{fmtHours(report.total_hours)}</div>
            </div>
            <div className="stat-card stat-card--warning">
              <div className="stat-label">{t.reports.billingAmount}</div>
              <div className="stat-value stat-value--sm">{fmtAmounts(report.total_amounts)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t.reports.invoicesIssued}</div>
              <div className="stat-value">{report.invoice_summary.count_total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t.reports.paid}</div>
              <div className="stat-value stat-value--sm">{fmtMoney(report.invoice_summary.total_paid)}</div>
            </div>
          </div>

          {/* Breakdown table */}
          {report.breakdown.length > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-header">
                <h2 className="card-title">{t.reports.breakdownTitle}</h2>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  {dateFrom} — {dateTo}
                </span>
              </div>
              <table className="table report-breakdown-table">
                <thead>
                  <tr>
                    <th>{t.reports.clientProjectCol}</th>
                    <th>{t.reports.entriesCol}</th>
                    <th className="td-num">{t.reports.hoursCol}</th>
                    <th className="td-num">{t.reports.amountCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.breakdown.map(client => (
                    <>
                      <tr
                        key={`client-${client.client_id}`}
                        className="report-client-row"
                        onClick={() => toggleClient(client.client_id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <span className="report-expand-icon">
                            {expanded.has(client.client_id) ? '▾' : '▸'}
                          </span>
                          {client.client_name}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {client.projects.reduce((s, p) => s + p.entries_count, 0)}
                        </td>
                        <td className="td-num report-client-num">{fmtHours(client.hours)}</td>
                        <td className="td-num report-client-num">{fmtAmounts(client.amounts_by_currency)}</td>
                      </tr>
                      {expanded.has(client.client_id) &&
                        client.projects.map(proj => (
                          <tr key={`proj-${proj.project_id}`} className="report-project-row">
                            <td className="report-project-name">{proj.project_name}</td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                              {proj.entries_count}
                            </td>
                            <td className="td-num">{fmtHours(proj.hours)}</td>
                            <td className="td-num">{fmtMoney(proj.amount)} {CURRENCY_SYMBOL[proj.currency as Currency] ?? proj.currency}</td>
                          </tr>
                        ))
                      }
                    </>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="report-total-row">
                    <td><strong>{t.reports.breakdownTotal}</strong></td>
                    <td></td>
                    <td className="td-num"><strong>{fmtHours(report.total_hours)} {hoursUnit}</strong></td>
                    <td className="td-num"><strong>{fmtAmounts(report.total_amounts)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Invoice summary */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h2 className="card-title">{t.reports.invoiceSummaryTitle}</h2>
            </div>
            {report.invoice_summary.count_total === 0 ? (
              <p className="dash-empty">{t.reports.noInvoices}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.reports.statusCol}</th>
                    <th className="td-num">{t.reports.countCol}</th>
                    <th className="td-num">{t.reports.amountCol}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="badge badge-paid">{t.reports.paidStatus}</span></td>
                    <td className="td-num">{report.invoice_summary.count_paid}</td>
                    <td className="td-num">{fmtMoney(report.invoice_summary.total_paid)}</td>
                  </tr>
                  <tr>
                    <td><span className="badge badge-sent">{t.reports.unpaidStatus}</span></td>
                    <td className="td-num">{report.invoice_summary.count_unpaid}</td>
                    <td className="td-num">{fmtMoney(report.invoice_summary.total_unpaid)}</td>
                  </tr>
                  {report.invoice_summary.count_overdue > 0 && (
                    <tr>
                      <td><span className="badge badge-overdue">{t.reports.overdueStatus}</span></td>
                      <td className="td-num">{report.invoice_summary.count_overdue}</td>
                      <td className="td-num">—</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="report-total-row">
                    <td><strong>{t.reports.totalIssued}</strong></td>
                    <td className="td-num"><strong>{report.invoice_summary.count_total}</strong></td>
                    <td className="td-num"><strong>{fmtMoney(report.invoice_summary.total_invoiced)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}

      {!report && !loading && (
        <div className="card" style={{ marginTop: 20 }}>
          <p className="dash-empty">{t.reports.selectPrompt}</p>
        </div>
      )}
    </div>
  )
}
