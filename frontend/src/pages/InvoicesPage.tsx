import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoicesService } from '@/services/invoices'
import { clientsService } from '@/services/clients'
import { projectsService } from '@/services/projects'
import { timeEntriesService } from '@/services/timeEntries'
import { useToast } from '@/context/ToastContext'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { InvoiceStatusBadge } from '@/components/ui/Badge'
import type {
  Client,
  Invoice,
  InvoiceCreate,
  InvoiceStatus,
  Page,
  Project,
  TimeEntry,
} from '@/types'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'sent', label: 'Отправлен' },
  { value: 'paid', label: 'Оплачен' },
  { value: 'overdue', label: 'Просрочен' },
]

const today = () => new Date().toISOString().slice(0, 10)
const futureDate = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const isOverdue = (inv: Invoice) =>
  (inv.status === 'sent' || inv.status === 'overdue') && inv.due_date < today()

export function InvoicesPage() {
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [data, setData] = useState<Page<Invoice> | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // Filters
  const [filterClient, setFilterClient] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [createClient, setCreateClient] = useState('')
  const [confirmedEntries, setConfirmedEntries] = useState<TimeEntry[]>([])
  const [clientProjects, setClientProjects] = useState<Project[]>([])
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set())
  const [issueDate, setIssueDate] = useState(today())
  const [dueDate, setDueDate] = useState(futureDate(14))
  const [notes, setNotes] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [entriesLoading, setEntriesLoading] = useState(false)

  useEffect(() => {
    clientsService.list({ size: 200 }).then(d => setClients(d.items)).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    invoicesService.list({
      client_id: filterClient ? Number(filterClient) : undefined,
      status: filterStatus as InvoiceStatus || undefined,
      date_from: filterDateFrom || undefined,
      date_to: filterDateTo || undefined,
      page,
      size: 20,
    })
      .then(setData)
      .catch(() => addToast('error', 'Ошибка загрузки счетов'))
      .finally(() => setLoading(false))
  }, [filterClient, filterStatus, filterDateFrom, filterDateTo, page, addToast])

  useEffect(() => { load() }, [load])

  // When client changes in create modal — load entries + projects
  useEffect(() => {
    if (!createClient) {
      setConfirmedEntries([])
      setClientProjects([])
      setSelectedEntries(new Set())
      return
    }
    setEntriesLoading(true)
    Promise.all([
      timeEntriesService.list({ client_id: Number(createClient), status: 'confirmed', size: 200 }),
      projectsService.list({ client_id: Number(createClient), size: 200 }),
    ])
      .then(([entries, projs]) => {
        setConfirmedEntries(entries.items)
        setClientProjects(projs.items)
        setSelectedEntries(new Set())
      })
      .catch(() => addToast('error', 'Ошибка загрузки данных клиента'))
      .finally(() => setEntriesLoading(false))
  }, [createClient, addToast])

  const projectMap = useMemo(() => {
    const m = new Map<number, Project>()
    clientProjects.forEach(p => m.set(p.id, p))
    return m
  }, [clientProjects])

  const toggleEntry = (id: number) => {
    setSelectedEntries(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedEntries.size === confirmedEntries.length) {
      setSelectedEntries(new Set())
    } else {
      setSelectedEntries(new Set(confirmedEntries.map(e => e.id)))
    }
  }

  // Preview rows for selected entries
  const previewRows = useMemo(() => {
    return confirmedEntries
      .filter(e => selectedEntries.has(e.id))
      .map(e => {
        const proj = projectMap.get(e.project_id)
        const rate = parseFloat(proj?.hourly_rate ?? '0')
        const hours = parseFloat(e.duration_hours)
        return {
          id: e.id,
          date: e.date,
          projectName: proj?.name ?? `#${e.project_id}`,
          description: e.description ?? '',
          hours,
          rate,
          amount: hours * rate,
          currency: proj?.currency ?? 'RUB',
        }
      })
  }, [confirmedEntries, selectedEntries, projectMap])

  const previewTotal = previewRows.reduce((s, r) => s + r.amount, 0)
  const allSelected =
    confirmedEntries.length > 0 && selectedEntries.size === confirmedEntries.length

  const resetCreateForm = () => {
    setCreateClient('')
    setConfirmedEntries([])
    setClientProjects([])
    setSelectedEntries(new Set())
    setIssueDate(today())
    setDueDate(futureDate(14))
    setNotes('')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createClient || selectedEntries.size === 0) {
      addToast('error', 'Выберите клиента и хотя бы одну запись времени')
      return
    }
    setCreateLoading(true)
    const payload: InvoiceCreate = {
      client_id: Number(createClient),
      time_entry_ids: Array.from(selectedEntries),
      issue_date: issueDate,
      due_date: dueDate,
      notes: notes || null,
    }
    try {
      const inv = await invoicesService.create(payload)
      addToast('success', `Счёт ${inv.invoice_number} создан`)
      setShowCreate(false)
      resetCreateForm()
      load()
    } catch (err: any) {
      addToast('error', err.message || 'Ошибка создания счёта')
    } finally {
      setCreateLoading(false)
    }
  }

  const clientName = (id: number) => clients.find(c => c.id === id)?.name ?? `#${id}`

  return (
    <div>
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="page-toolbar">
        <div className="filter-bar">
          <select
            className="form-input form-select filter-select"
            value={filterClient}
            onChange={e => { setFilterClient(e.target.value); setPage(1) }}
          >
            <option value="">Все клиенты</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            className="form-input form-select filter-select"
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          >
            <option value="">Все статусы</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <input
            type="date"
            className="form-input filter-select"
            value={filterDateFrom}
            onChange={e => { setFilterDateFrom(e.target.value); setPage(1) }}
            title="Дата выставления от"
          />
          <input
            type="date"
            className="form-input filter-select"
            value={filterDateTo}
            onChange={e => { setFilterDateTo(e.target.value); setPage(1) }}
            title="Дата выставления до"
          />
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Создать счёт</Button>
      </div>

      {/* ── Invoices table ──────────────────────────────────────────────────── */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>№ Счёта</th>
                <th>Клиент</th>
                <th>Дата</th>
                <th>Срок оплаты</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    <span className="loading-text">Загрузка...</span>
                  </td>
                </tr>
              ) : (data?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">Счета не найдены</td>
                </tr>
              ) : (
                (data?.items ?? []).map(inv => (
                  <tr key={inv.id} className={isOverdue(inv) ? 'row-overdue' : undefined}>
                    <td className="invoice-num">{inv.invoice_number}</td>
                    <td>{clientName(inv.client_id)}</td>
                    <td>{inv.issue_date}</td>
                    <td>
                      <span className={isOverdue(inv) ? 'overdue-date' : undefined}>
                        {inv.due_date}
                      </span>
                      {isOverdue(inv) && (
                        <span className="overdue-tag">просрочен</span>
                      )}
                    </td>
                    <td className="td-num">
                      {Number(inv.total_amount).toLocaleString('ru-RU', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} ₽
                    </td>
                    <td><InvoiceStatusBadge status={inv.status} /></td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                      >
                        Открыть →
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pages={data?.pages ?? 0}
          total={data?.total ?? 0}
          onPageChange={setPage}
        />
      </div>

      {/* ── Create invoice modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); resetCreateForm() }}
        title="Создать счёт"
        size="lg"
      >
        <form onSubmit={handleCreate}>
          {/* Step 1: client */}
          <div className="form-group">
            <label className="form-label">Клиент *</label>
            <select
              className="form-input form-select"
              value={createClient}
              onChange={e => setCreateClient(e.target.value)}
              required
            >
              <option value="">Выберите клиента</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Step 2: entries checklist */}
          {createClient && (
            <div className="form-group">
              <div className="create-entries-header">
                <label className="form-label" style={{ margin: 0 }}>
                  Подтверждённые записи времени *
                </label>
                {confirmedEntries.length > 0 && (
                  <label className="check-all-label">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                    Выбрать все
                  </label>
                )}
              </div>

              {entriesLoading ? (
                <p className="loading-text" style={{ padding: '12px 0' }}>Загрузка...</p>
              ) : confirmedEntries.length === 0 ? (
                <p className="create-no-entries">
                  Нет подтверждённых записей для этого клиента
                </p>
              ) : (
                <div className="entry-checklist">
                  {confirmedEntries.map(entry => {
                    const proj = projectMap.get(entry.project_id)
                    const rate = parseFloat(proj?.hourly_rate ?? '0')
                    const amount = parseFloat(entry.duration_hours) * rate
                    return (
                      <label
                        key={entry.id}
                        className={`entry-check-item${selectedEntries.has(entry.id) ? ' entry-check-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEntries.has(entry.id)}
                          onChange={() => toggleEntry(entry.id)}
                        />
                        <span className="entry-check-date">{entry.date}</span>
                        <span className="entry-check-project">
                          {proj?.name ?? `#${entry.project_id}`}
                        </span>
                        {entry.description && (
                          <span className="entry-check-desc">{entry.description}</span>
                        )}
                        <span className="entry-check-hours">{entry.duration_hours} ч</span>
                        {rate > 0 && (
                          <span className="entry-check-amount">
                            {amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: preview table */}
          {previewRows.length > 0 && (
            <div className="form-group">
              <label className="form-label">Предпросмотр счёта</label>
              <div className="invoice-preview">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Проект</th>
                      <th>Описание</th>
                      <th>Часы</th>
                      <th>Ставка</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map(r => (
                      <tr key={r.id}>
                        <td>{r.date}</td>
                        <td>{r.projectName}</td>
                        <td className="td-desc">{r.description || '—'}</td>
                        <td className="td-num">{r.hours.toFixed(1)}</td>
                        <td className="td-num">
                          {r.rate > 0
                            ? `${r.rate.toLocaleString('ru-RU')} ${r.currency}`
                            : '—'}
                        </td>
                        <td className="td-num">
                          {r.rate > 0
                            ? `${r.amount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${r.currency}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="table-total-row">
                      <td colSpan={3} className="total-label">Итого:</td>
                      <td className="td-num total-value">
                        {previewRows.reduce((s, r) => s + r.hours, 0).toFixed(1)} ч
                      </td>
                      <td />
                      <td className="td-num total-value">
                        {previewTotal > 0
                          ? `${previewTotal.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽`
                          : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: dates + notes */}
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Дата выставления *</label>
              <input
                type="date"
                className="form-input"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Срок оплаты * (по умолч. +14 дней)</label>
              <input
                type="date"
                className="form-input"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Примечания</label>
            <textarea
              className="form-input form-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Необязательно"
            />
          </div>

          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowCreate(false); resetCreateForm() }}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              loading={createLoading}
              disabled={selectedEntries.size === 0}
            >
              Создать счёт{selectedEntries.size > 0 && ` (${selectedEntries.size})`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
