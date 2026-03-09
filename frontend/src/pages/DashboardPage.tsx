import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardService } from '@/services/dashboard'
import { getRate, CURRENCY_SYMBOL } from '@/services/exchange'
import { useLanguage } from '@/i18n/translations'
import type { Currency, DashboardData, InvoiceStatus, TimeEntryStatus } from '@/types'

export function DashboardPage() {
  const { lang, t } = useLanguage()
  const locale = lang === 'en' ? 'en-US' : 'ru-RU'
  const fmt = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 })
  const fmtMoney = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [unbilledCurrency, setUnbilledCurrency] = useState<Currency>('RUB')
  const [unbilledConverted, setUnbilledConverted] = useState<{ amount: number; loading: boolean }>({ amount: 0, loading: false })
  const [paidCurrency, setPaidCurrency] = useState<Currency>('RUB')
  const [paidPeriod, setPaidPeriod] = useState<'month' | 'year'>('month')
  const [paidConverted, setPaidConverted] = useState<{ amount: number; loading: boolean }>({ amount: 0, loading: false })

  useEffect(() => {
    dashboardService.get()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!data) return
    const entries = Object.entries(data.unbilled_by_currency ?? {}) as [Currency, number][]
    if (entries.length === 0) { setUnbilledConverted({ amount: 0, loading: false }); return }
    setUnbilledConverted(prev => ({ ...prev, loading: true }))
    Promise.all(entries.map(async ([cur, amt]) => amt * await getRate(cur, unbilledCurrency)))
      .then(amounts => setUnbilledConverted({ amount: amounts.reduce((s, a) => s + a, 0), loading: false }))
      .catch(() => setUnbilledConverted({ amount: 0, loading: false }))
  }, [data, unbilledCurrency])

  useEffect(() => {
    if (!data) return
    const source = paidPeriod === 'month' ? data.paid_this_month_by_currency : data.paid_this_year_by_currency
    const entries = Object.entries(source ?? {}) as [Currency, number][]
    if (entries.length === 0) { setPaidConverted({ amount: 0, loading: false }); return }
    setPaidConverted(prev => ({ ...prev, loading: true }))
    Promise.all(entries.map(async ([cur, amt]) => amt * await getRate(cur, paidCurrency)))
      .then(amounts => setPaidConverted({ amount: amounts.reduce((s, a) => s + a, 0), loading: false }))
      .catch(() => setPaidConverted({ amount: 0, loading: false }))
  }, [data, paidCurrency, paidPeriod])

  if (loading) return <span className="loading-text">{t.common.loading}</span>

  if (!data) return (
    <div className="card">
      <p style={{ color: 'var(--text-secondary)' }}>{t.dashboard.loadFailed}</p>
    </div>
  )

  const STATUS_LABEL: Record<TimeEntryStatus | InvoiceStatus, string> = {
    draft: t.status.draft,
    confirmed: t.status.confirmed,
    billed: t.status.billed,
    sent: t.status.sent,
    paid: t.status.paid,
    overdue: t.status.overdue,
  }

  const STATUS_CLASS: Record<TimeEntryStatus | InvoiceStatus, string> = {
    draft: 'badge-draft',
    confirmed: 'badge-confirmed',
    billed: 'badge-billed',
    sent: 'badge-sent',
    paid: 'badge-paid',
    overdue: 'badge-overdue',
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      {/* ── Metric cards ─────────────────────────────────────────────────── */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-label">{t.dashboard.hoursWeek}</div>
          <div className="stat-value">{fmt(data.hours_this_week)}</div>
          <div className="stat-sub">{t.dashboard.sinceMonday}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.dashboard.hoursMonth}</div>
          <div className="stat-value">{fmt(data.hours_this_month)}</div>
          <div className="stat-sub">{t.dashboard.currentMonth}</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-label">{t.dashboard.unbilled}</div>
          <div className="stat-value stat-value--sm">
            {unbilledConverted.loading
              ? '…'
              : `${fmtMoney(unbilledConverted.amount)} ${CURRENCY_SYMBOL[unbilledCurrency]}`}
          </div>
          <div className="stat-sub">{t.dashboard.confirmedLabel}</div>
          <div className="lang-switcher" style={{ padding: '4px 0 0' }}>
            {(['RUB', 'USD', 'EUR'] as Currency[]).map(cur => (
              <button
                key={cur}
                className={`lang-btn ${unbilledCurrency === cur ? 'lang-btn-active' : ''}`}
                onClick={() => setUnbilledCurrency(cur)}
                style={{ fontSize: 10, padding: '2px 5px' }}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-label">{t.dashboard.paidInvoices}</div>
          <div className="stat-value stat-value--sm">
            {paidConverted.loading
              ? '…'
              : `${fmtMoney(paidConverted.amount)} ${CURRENCY_SYMBOL[paidCurrency]}`}
          </div>
          <div className="lang-switcher" style={{ padding: '4px 0 2px' }}>
            {(['month', 'year'] as const).map(p => (
              <button
                key={p}
                className={`lang-btn ${paidPeriod === p ? 'lang-btn-active' : ''}`}
                onClick={() => setPaidPeriod(p)}
                style={{ fontSize: 10, padding: '2px 5px' }}
              >
                {p === 'month' ? t.dashboard.month : t.dashboard.year}
              </button>
            ))}
          </div>
          <div className="lang-switcher" style={{ padding: '2px 0 0' }}>
            {(['RUB', 'USD', 'EUR'] as Currency[]).map(cur => (
              <button
                key={cur}
                className={`lang-btn ${paidCurrency === cur ? 'lang-btn-active' : ''}`}
                onClick={() => setPaidCurrency(cur)}
                style={{ fontSize: 10, padding: '2px 5px' }}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>
        <div className={`stat-card ${data.overdue_invoices_count > 0 ? 'stat-card--danger' : ''}`}>
          <div className="stat-label">{t.dashboard.overdueInvoices}</div>
          <div className="stat-value">{data.overdue_invoices_count}</div>
          <div className="stat-sub">
            {data.unpaid_amount > 0
              ? `${fmtMoney(data.unpaid_amount)} ₽ ${t.dashboard.unpaid}`
              : t.dashboard.allGood}
          </div>
        </div>
      </div>

      {/* ── Recent lists ─────────────────────────────────────────────────── */}
      <div className="dashboard-lists">
        {/* Recent time entries */}
        <div className="card dash-list-card">
          <div className="card-header">
            <h2 className="card-title">{t.dashboard.recentEntries}</h2>
            <Link to="/time-entries" className="btn btn-sm btn-ghost">{t.dashboard.allBtn}</Link>
          </div>
          {data.recent_time_entries.length === 0 ? (
            <p className="dash-empty">{t.dashboard.noEntries}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t.common.date}</th>
                  <th>{t.dashboard.clientProject}</th>
                  <th>{t.common.description}</th>
                  <th className="td-num">{t.common.hours}</th>
                  <th>{t.common.status}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_time_entries.map(e => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{e.date}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{e.client_name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{e.project_name}</div>
                    </td>
                    <td className="td-desc">{e.description || '—'}</td>
                    <td className="td-num">{e.duration_hours}</td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[e.status]}`}>
                        {STATUS_LABEL[e.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent invoices */}
        <div className="card dash-list-card">
          <div className="card-header">
            <h2 className="card-title">{t.dashboard.recentInvoices}</h2>
            <Link to="/invoices" className="btn btn-sm btn-ghost">{t.dashboard.allBtn}</Link>
          </div>
          {data.recent_invoices.length === 0 ? (
            <p className="dash-empty">{t.dashboard.noInvoices}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t.dashboard.number}</th>
                  <th>{t.common.client}</th>
                  <th>{t.dashboard.due}</th>
                  <th className="td-num">{t.common.amount}</th>
                  <th>{t.common.status}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_invoices.map(inv => {
                  const isOverdue =
                    (inv.status === 'sent' || inv.status === 'overdue') &&
                    inv.due_date < today
                  return (
                    <tr key={inv.id} className={isOverdue ? 'row-overdue' : ''}>
                      <td>
                        <Link to={`/invoices/${inv.id}`} className="invoice-num">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td>{inv.client_name}</td>
                      <td style={{ whiteSpace: 'nowrap' }}
                          className={isOverdue ? 'overdue-date' : ''}>
                        {inv.due_date}
                      </td>
                      <td className="td-num">{fmtMoney(inv.total_amount)} {CURRENCY_SYMBOL[inv.currency]}</td>
                      <td>
                        <span className={`badge ${STATUS_CLASS[inv.status]}`}>
                          {STATUS_LABEL[inv.status]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
