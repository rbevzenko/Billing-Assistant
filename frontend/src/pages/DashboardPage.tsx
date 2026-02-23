import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardService } from '@/services/dashboard'
import { getRate, CURRENCY_SYMBOL } from '@/services/exchange'
import type { Currency, DashboardData, InvoiceStatus, TimeEntryStatus } from '@/types'

function fmt(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

function fmtMoney(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const STATUS_LABEL: Record<TimeEntryStatus | InvoiceStatus, string> = {
  draft: 'Черновик',
  confirmed: 'Подтверждено',
  billed: 'Выставлен',
  sent: 'Отправлен',
  paid: 'Оплачен',
  overdue: 'Просрочен',
}

const STATUS_CLASS: Record<TimeEntryStatus | InvoiceStatus, string> = {
  draft: 'badge-draft',
  confirmed: 'badge-confirmed',
  billed: 'badge-billed',
  sent: 'badge-sent',
  paid: 'badge-paid',
  overdue: 'badge-overdue',
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [unbilledCurrency, setUnbilledCurrency] = useState<Currency>('RUB')
  const [unbilledConverted, setUnbilledConverted] = useState<{ amount: number; loading: boolean }>({ amount: 0, loading: false })

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

  if (loading) return <span className="loading-text">Загрузка…</span>

  if (!data) return (
    <div className="card">
      <p style={{ color: 'var(--text-secondary)' }}>Не удалось загрузить данные дашборда.</p>
    </div>
  )

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      {/* ── Metric cards ─────────────────────────────────────────────────── */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-label">Часы за неделю</div>
          <div className="stat-value">{fmt(data.hours_this_week)}</div>
          <div className="stat-sub">с понедельника</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Часы за месяц</div>
          <div className="stat-value">{fmt(data.hours_this_month)}</div>
          <div className="stat-sub">текущий месяц</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-label">Не выставлено счетов</div>
          <div className="stat-value stat-value--sm">
            {unbilledConverted.loading
              ? '…'
              : `${fmtMoney(unbilledConverted.amount)} ${CURRENCY_SYMBOL[unbilledCurrency]}`}
          </div>
          <div className="stat-sub">подтверждённые</div>
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
        <div className={`stat-card ${data.overdue_invoices_count > 0 ? 'stat-card--danger' : ''}`}>
          <div className="stat-label">Просроченных счетов</div>
          <div className="stat-value">{data.overdue_invoices_count}</div>
          <div className="stat-sub">
            {data.unpaid_amount > 0
              ? `${fmtMoney(data.unpaid_amount)} ₽ не оплачено`
              : 'всё в порядке'}
          </div>
        </div>
      </div>

      {/* ── Recent lists ─────────────────────────────────────────────────── */}
      <div className="dashboard-lists">
        {/* Recent time entries */}
        <div className="card dash-list-card">
          <div className="card-header">
            <h2 className="card-title">Последние записи времени</h2>
            <Link to="/time-entries" className="btn btn-sm btn-ghost">Все →</Link>
          </div>
          {data.recent_time_entries.length === 0 ? (
            <p className="dash-empty">Записей нет</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Клиент / Проект</th>
                  <th>Описание</th>
                  <th className="td-num">Часы</th>
                  <th>Статус</th>
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
            <h2 className="card-title">Последние счета</h2>
            <Link to="/invoices" className="btn btn-sm btn-ghost">Все →</Link>
          </div>
          {data.recent_invoices.length === 0 ? (
            <p className="dash-empty">Счетов нет</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Клиент</th>
                  <th>До</th>
                  <th className="td-num">Сумма</th>
                  <th>Статус</th>
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
                      <td className="td-num">{fmtMoney(inv.total_amount)} ₽</td>
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
