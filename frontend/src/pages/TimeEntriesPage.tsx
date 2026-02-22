import { useCallback, useEffect, useMemo, useState } from 'react'
import { timeEntriesService } from '@/services/timeEntries'
import { projectsService } from '@/services/projects'
import { clientsService } from '@/services/clients'
import { getRate, CURRENCY_SYMBOL } from '@/services/exchange'
import { useToast } from '@/context/ToastContext'
import { useTimer } from '@/context/TimerContext'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { TimeStatusBadge } from '@/components/ui/Badge'
import type { Client, Currency, Page, Project, TimeEntry, TimeEntryCreate, TimeEntryStatus, TimeEntryUpdate } from '@/types'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'confirmed', label: 'Подтверждён' },
  { value: 'billed', label: 'Выставлен' },
]

const today = () => new Date().toISOString().slice(0, 10)

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

export function TimeEntriesPage() {
  const { addToast } = useToast()
  const timer = useTimer()

  const [data, setData] = useState<Page<TimeEntry> | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // Filters
  const [filterClient, setFilterClient] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Quick entry form
  const [qProject, setQProject] = useState(() =>
    timer.projectId ? String(timer.projectId) : ''
  )
  const [qDate, setQDate] = useState(today())
  const [qHours, setQHours] = useState('')
  const [qDesc, setQDesc] = useState('')
  const [qLoading, setQLoading] = useState(false)

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  // Edit modal
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [editForm, setEditForm] = useState<TimeEntryUpdate>({})
  const [editLoading, setEditLoading] = useState(false)

  // Delete
  const [deleteEntry, setDeleteEntry] = useState<TimeEntry | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    projectsService.list({ size: 200 }).then(d => setProjects(d.items)).catch(() => {})
    clientsService.list({ size: 200 }).then(d => setClients(d.items)).catch(() => {})
  }, [])

  // Sync quick form project when timer is already running on mount
  useEffect(() => {
    if (timer.projectId && !qProject) {
      setQProject(String(timer.projectId))
    }
  }, [timer.projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(() => {
    setLoading(true)
    timeEntriesService.list({
      client_id: filterClient ? Number(filterClient) : undefined,
      project_id: filterProject ? Number(filterProject) : undefined,
      status: filterStatus as TimeEntryStatus || undefined,
      date_from: filterDateFrom || undefined,
      date_to: filterDateTo || undefined,
      page,
      size: 20,
    })
      .then(d => { setData(d); setSelectedIds(new Set()) })
      .catch(() => addToast('error', 'Ошибка загрузки записей'))
      .finally(() => setLoading(false))
  }, [filterClient, filterProject, filterStatus, filterDateFrom, filterDateTo, page, addToast])

  useEffect(() => { load() }, [load])

  // Derived maps
  const projectMap = useMemo(() => {
    const m = new Map<number, Project>()
    projects.forEach(p => m.set(p.id, p))
    return m
  }, [projects])

  const clientMap = useMemo(() => {
    const m = new Map<number, Client>()
    clients.forEach(c => m.set(c.id, c))
    return m
  }, [clients])

  // Projects grouped by client for optgroup select
  const projectsByClient = useMemo(() => {
    const map = new Map<number, Project[]>()
    projects.forEach(p => {
      if (!map.has(p.client_id)) map.set(p.client_id, [])
      map.get(p.client_id)!.push(p)
    })
    return map
  }, [projects])

  // Projects filtered by selected filter-client
  const filteredProjects = filterClient
    ? projects.filter(p => p.client_id === Number(filterClient))
    : projects

  // Handlers
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!qProject || !qHours) return
    setQLoading(true)
    const payload: TimeEntryCreate = {
      project_id: Number(qProject),
      date: qDate,
      duration_hours: qHours,
      description: qDesc || null,
    }
    try {
      await timeEntriesService.create(payload)
      addToast('success', 'Запись добавлена')
      setQHours('')
      setQDesc('')
      load()
    } catch (err: any) {
      addToast('error', err.message || 'Ошибка создания записи')
    } finally {
      setQLoading(false)
    }
  }

  const handleTimerStart = () => {
    if (!qProject) {
      addToast('info', 'Выберите проект для запуска таймера')
      return
    }
    timer.startTimer(Number(qProject))
  }

  const handleTimerStop = () => {
    const hours = timer.stopTimer()
    setQHours(String(hours))
  }

  const openEdit = (entry: TimeEntry) => {
    setEditEntry(entry)
    setEditForm({
      date: entry.date,
      duration_hours: entry.duration_hours,
      description: entry.description,
      status: entry.status,
    })
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editEntry) return
    setEditLoading(true)
    try {
      await timeEntriesService.update(editEntry.id, editForm)
      addToast('success', 'Запись обновлена')
      setEditEntry(null)
      load()
    } catch (err: any) {
      addToast('error', err.message || 'Ошибка обновления')
    } finally {
      setEditLoading(false)
    }
  }

  const handleConfirm = async (entry: TimeEntry) => {
    try {
      await timeEntriesService.confirm(entry.id)
      addToast('success', 'Запись подтверждена')
      load()
    } catch {
      addToast('error', 'Ошибка подтверждения')
    }
  }

  const handleBulkConfirm = async () => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      const result = await timeEntriesService.bulkConfirm(Array.from(selectedIds))
      addToast('success', `Подтверждено: ${result.confirmed_count}`)
      setSelectedIds(new Set())
      load()
    } catch {
      addToast('error', 'Ошибка массового подтверждения')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteEntry) return
    setDeleteLoading(true)
    try {
      await timeEntriesService.delete(deleteEntry.id)
      addToast('success', 'Запись удалена')
      setDeleteEntry(null)
      load()
    } catch (err: any) {
      addToast('error', err.message || 'Не удалось удалить запись')
    } finally {
      setDeleteLoading(false)
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const draftItems = (data?.items ?? []).filter(e => e.status === 'draft')
  const allDraftSelected =
    draftItems.length > 0 && draftItems.every(e => selectedIds.has(e.id))

  const toggleSelectAll = () => {
    const ids = draftItems.map(e => e.id)
    if (allDraftSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.add(id))
        return next
      })
    }
  }

  // Page-level totals
  const [totalCurrency, setTotalCurrency] = useState<Currency>('RUB')
  const [totalConverted, setTotalConverted] = useState<{ amount: number; loading: boolean }>({ amount: 0, loading: false })

  const totalHours = useMemo(
    () => (data?.items ?? []).reduce((sum, e) => sum + parseFloat(e.duration_hours), 0),
    [data],
  )

  useEffect(() => {
    const items = data?.items ?? []
    // Group raw amounts by project currency
    const byCurrency = new Map<Currency, number>()
    for (const e of items) {
      const proj = projectMap.get(e.project_id)
      if (!proj?.hourly_rate) continue
      const hours = parseFloat(e.duration_hours)
      const cur = (proj.currency ?? 'RUB') as Currency
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + hours * parseFloat(proj.hourly_rate))
    }
    if (byCurrency.size === 0) { setTotalConverted({ amount: 0, loading: false }); return }

    setTotalConverted(prev => ({ ...prev, loading: true }))
    Promise.all(
      Array.from(byCurrency.entries()).map(async ([cur, amt]) => amt * await getRate(cur, totalCurrency))
    )
      .then(amounts => setTotalConverted({ amount: amounts.reduce((s, a) => s + a, 0), loading: false }))
      .catch(() => setTotalConverted({ amount: 0, loading: false }))
  }, [data, projectMap, totalCurrency])

  const timerProjectName = timer.projectId
    ? (projectMap.get(timer.projectId)?.name ?? '')
    : ''

  return (
    <div>
      {/* ── Quick entry + Timer ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title">Быстрое добавление</h2>
          {timer.isRunning && (
            <div className="timer-display">
              <span className="timer-dot" />
              <span className="timer-clock">{formatElapsed(timer.elapsed)}</span>
              {timerProjectName && (
                <span className="timer-project">{timerProjectName}</span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleQuickAdd} className="quick-form">
          {/* Grouped project select */}
          <div className="form-group">
            <select
              className="form-input form-select"
              value={qProject}
              onChange={e => setQProject(e.target.value)}
              required
              disabled={timer.isRunning}
            >
              <option value="">Проект *</option>
              {Array.from(projectsByClient.entries()).map(([clientId, projs]) => (
                <optgroup
                  key={clientId}
                  label={clientMap.get(clientId)?.name ?? `Клиент #${clientId}`}
                >
                  {projs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="form-group">
            <input
              type="date"
              className="form-input"
              value={qDate}
              onChange={e => setQDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <input
              type="number"
              step="0.1"
              min="0.1"
              className="form-input"
              placeholder="Часы *"
              value={qHours}
              onChange={e => setQHours(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ flex: 2, minWidth: 180 }}>
            <input
              className="form-input"
              placeholder="Описание работы"
              value={qDesc}
              onChange={e => setQDesc(e.target.value)}
            />
          </div>

          <div className="quick-form-actions">
            <Button type="submit" loading={qLoading}>Сохранить</Button>
            {!timer.isRunning ? (
              <Button type="button" variant="secondary" onClick={handleTimerStart}>
                ▶ Старт
              </Button>
            ) : (
              <Button type="button" variant="danger" onClick={handleTimerStop}>
                ■ Стоп
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* ── Filters + Bulk actions ──────────────────────────────────────────── */}
      <div className="page-toolbar">
        <div className="filter-bar">
          <select
            className="form-input form-select filter-select"
            value={filterClient}
            onChange={e => {
              setFilterClient(e.target.value)
              setFilterProject('')
              setPage(1)
            }}
          >
            <option value="">Все клиенты</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            className="form-input form-select filter-select"
            value={filterProject}
            onChange={e => { setFilterProject(e.target.value); setPage(1) }}
          >
            <option value="">Все проекты</option>
            {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
            title="Дата от"
          />
          <input
            type="date"
            className="form-input filter-select"
            value={filterDateTo}
            onChange={e => { setFilterDateTo(e.target.value); setPage(1) }}
            title="Дата до"
          />
        </div>

        {selectedIds.size > 0 && (
          <Button variant="primary" loading={bulkLoading} onClick={handleBulkConfirm}>
            Подтвердить выбранные ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={allDraftSelected}
                    onChange={toggleSelectAll}
                    disabled={draftItems.length === 0}
                    title="Выбрать все черновики"
                  />
                </th>
                <th>Дата</th>
                <th>Клиент</th>
                <th>Проект</th>
                <th>Описание</th>
                <th>Часы</th>
                <th>Ставка</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="table-empty">
                    <span className="loading-text">Загрузка...</span>
                  </td>
                </tr>
              ) : (data?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={10} className="table-empty">Записи не найдены</td>
                </tr>
              ) : (
                (data?.items ?? []).map(entry => {
                  const proj = projectMap.get(entry.project_id)
                  const client = proj ? clientMap.get(proj.client_id) : undefined
                  const rate = parseFloat(proj?.hourly_rate ?? '0')
                  const hours = parseFloat(entry.duration_hours)
                  const amount = hours * rate
                  const currency = proj?.currency ?? 'RUB'

                  return (
                    <tr
                      key={entry.id}
                      className={selectedIds.has(entry.id) ? 'row-selected' : undefined}
                    >
                      <td className="col-check">
                        {entry.status === 'draft' && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(entry.id)}
                            onChange={() => toggleSelect(entry.id)}
                          />
                        )}
                      </td>
                      <td>{entry.date}</td>
                      <td>{client?.name ?? '—'}</td>
                      <td>{proj?.name ?? `#${entry.project_id}`}</td>
                      <td className="td-desc">{entry.description ?? '—'}</td>
                      <td className="td-num">{hours.toFixed(1)} ч</td>
                      <td className="td-num">
                        {rate ? `${rate.toLocaleString('ru')} ${currency}` : '—'}
                      </td>
                      <td className="td-num">
                        {rate ? `${amount.toLocaleString('ru', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}` : '—'}
                      </td>
                      <td><TimeStatusBadge status={entry.status} /></td>
                      <td>
                        <div className="table-actions">
                          {entry.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleConfirm(entry)}
                            >
                              Подтвердить
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(entry)}
                          >
                            Изм.
                          </Button>
                          {entry.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setDeleteEntry(entry)}
                            >
                              Удалить
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>

            {!loading && (data?.items ?? []).length > 0 && (
              <tfoot>
                <tr className="table-total-row">
                  <td colSpan={5} className="total-label">
                    Итого по странице ({data?.total ?? 0} всего):
                  </td>
                  <td className="td-num total-value">{totalHours.toFixed(1)} ч</td>
                  <td />
                  <td className="td-num total-value">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <div className="lang-switcher" style={{ padding: 0 }}>
                        {(['RUB', 'USD', 'EUR'] as Currency[]).map(cur => (
                          <button
                            key={cur}
                            className={`lang-btn ${totalCurrency === cur ? 'lang-btn-active' : ''}`}
                            onClick={() => setTotalCurrency(cur)}
                            style={{ fontSize: 10, padding: '2px 5px' }}
                          >
                            {cur}
                          </button>
                        ))}
                      </div>
                      <span>
                        {totalConverted.loading
                          ? '…'
                          : totalConverted.amount > 0
                            ? `${totalConverted.amount.toLocaleString('ru', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY_SYMBOL[totalCurrency]}`
                            : '—'}
                      </span>
                    </div>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <Pagination
          page={page}
          pages={data?.pages ?? 0}
          total={data?.total ?? 0}
          onPageChange={setPage}
        />
      </div>

      {/* ── Edit modal ─────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editEntry}
        onClose={() => setEditEntry(null)}
        title="Редактировать запись"
        size="sm"
      >
        <form onSubmit={handleEdit}>
          <div className="form-group">
            <label className="form-label">Дата</label>
            <input
              type="date"
              className="form-input"
              value={editForm.date ?? ''}
              onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Часы</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              className="form-input"
              value={editForm.duration_hours ?? ''}
              onChange={e =>
                setEditForm(p => ({ ...p, duration_hours: e.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Описание</label>
            <input
              className="form-input"
              value={editForm.description ?? ''}
              onChange={e =>
                setEditForm(p => ({ ...p, description: e.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Статус</label>
            <select
              className="form-input form-select"
              value={editForm.status ?? ''}
              onChange={e =>
                setEditForm(p => ({ ...p, status: e.target.value as TimeEntryStatus }))
              }
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditEntry(null)}
            >
              Отмена
            </Button>
            <Button type="submit" loading={editLoading}>Сохранить</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteEntry}
        onClose={() => setDeleteEntry(null)}
        onConfirm={handleDelete}
        title="Удалить запись"
        message="Вы уверены, что хотите удалить эту запись?"
        loading={deleteLoading}
      />
    </div>
  )
}
