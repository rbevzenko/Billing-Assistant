import { useEffect, useState } from 'react'
import { reportsService } from '@/services/reports'
import { clientsService } from '@/services/clients'
import type { Client, ReportData } from '@/types'

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

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'this_month', label: 'Текущий месяц' },
  { id: 'last_month', label: 'Прошлый месяц' },
  { id: 'this_quarter', label: 'Текущий квартал' },
  { id: 'this_year', label: 'Текущий год' },
  { id: 'custom', label: 'Произвольный' },
]

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

function fmtMoney(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtHours(n: number): string {
  return n.toFixed(1)
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReportsPage() {
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

  return (
    <div>
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="card report-filters-card">
        <div className="card-header">
          <h2 className="card-title">Отчёт по времени и биллингу</h2>
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
            <label className="form-label">Начало периода</label>
            <input
              type="date"
              className="form-control"
              value={dateFrom}
              onChange={e => { setPreset('custom'); setDateFrom(e.target.value) }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Конец периода</label>
            <input
              type="date"
              className="form-control"
              value={dateTo}
              onChange={e => { setPreset('custom'); setDateTo(e.target.value) }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Клиент</label>
            <select
              className="form-control"
              value={clientId ?? ''}
              onChange={e => setClientId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Все клиенты</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="report-filter-actions">
            <button className="btn btn-primary" onClick={handleLoad} disabled={loading}>
              {loading ? 'Загрузка…' : 'Сформировать'}
            </button>
            {report && (
              <button className="btn btn-outline" onClick={handlePdf} disabled={pdfLoading}>
                {pdfLoading ? 'Генерация…' : '⬇ PDF'}
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
              <div className="stat-label">Всего часов</div>
              <div className="stat-value">{fmtHours(report.total_hours)}</div>
            </div>
            <div className="stat-card stat-card--warning">
              <div className="stat-label">Сумма к биллингу</div>
              <div className="stat-value stat-value--sm">{fmtMoney(report.total_amount)} ₽</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Счетов выставлено</div>
              <div className="stat-value">{report.invoice_summary.count_total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Оплачено</div>
              <div className="stat-value stat-value--sm">{fmtMoney(report.invoice_summary.total_paid)} ₽</div>
            </div>
          </div>

          {/* Breakdown table */}
          {report.breakdown.length > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-header">
                <h2 className="card-title">Детализация по клиентам и проектам</h2>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  {dateFrom} — {dateTo}
                </span>
              </div>
              <table className="table report-breakdown-table">
                <thead>
                  <tr>
                    <th>Клиент / Проект</th>
                    <th>Записей</th>
                    <th className="td-num">Часы</th>
                    <th className="td-num">Сумма, ₽</th>
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
                        <td className="td-num report-client-num">{fmtMoney(client.amount)}</td>
                      </tr>
                      {expanded.has(client.client_id) &&
                        client.projects.map(proj => (
                          <tr key={`proj-${proj.project_id}`} className="report-project-row">
                            <td className="report-project-name">{proj.project_name}</td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                              {proj.entries_count}
                            </td>
                            <td className="td-num">{fmtHours(proj.hours)}</td>
                            <td className="td-num">{fmtMoney(proj.amount)}</td>
                          </tr>
                        ))
                      }
                    </>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="report-total-row">
                    <td><strong>ИТОГО</strong></td>
                    <td></td>
                    <td className="td-num"><strong>{fmtHours(report.total_hours)} ч</strong></td>
                    <td className="td-num"><strong>{fmtMoney(report.total_amount)} ₽</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Invoice summary */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h2 className="card-title">Сводка по счетам</h2>
            </div>
            {report.invoice_summary.count_total === 0 ? (
              <p className="dash-empty">Счетов за период нет</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Статус</th>
                    <th className="td-num">Количество</th>
                    <th className="td-num">Сумма, ₽</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="badge badge-paid">Оплачено</span></td>
                    <td className="td-num">{report.invoice_summary.count_paid}</td>
                    <td className="td-num">{fmtMoney(report.invoice_summary.total_paid)}</td>
                  </tr>
                  <tr>
                    <td><span className="badge badge-sent">Не оплачено</span></td>
                    <td className="td-num">{report.invoice_summary.count_unpaid}</td>
                    <td className="td-num">{fmtMoney(report.invoice_summary.total_unpaid)}</td>
                  </tr>
                  {report.invoice_summary.count_overdue > 0 && (
                    <tr>
                      <td><span className="badge badge-overdue">Просрочено</span></td>
                      <td className="td-num">{report.invoice_summary.count_overdue}</td>
                      <td className="td-num">—</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="report-total-row">
                    <td><strong>Всего выставлено</strong></td>
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
          <p className="dash-empty">Выберите период и нажмите «Сформировать»</p>
        </div>
      )}
    </div>
  )
}
