import { useCallback, useEffect, useState } from 'react'
import { timeEntriesService } from '@/services/timeEntries'
import { projectsService } from '@/services/projects'
import { useToast } from '@/context/ToastContext'
import { Table } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { TimeStatusBadge } from '@/components/ui/Badge'
import type { Column, Page, Project, TimeEntry, TimeEntryCreate, TimeEntryStatus, TimeEntryUpdate } from '@/types'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'confirmed', label: 'Подтверждён' },
  { value: 'billed', label: 'Выставлен' },
]

const today = () => new Date().toISOString().slice(0, 10)

export function TimeEntriesPage() {
  const { addToast } = useToast()
  const [data, setData] = useState<Page<TimeEntry> | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // Filters
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Quick entry form
  const [qProject, setQProject] = useState('')
  const [qDate, setQDate] = useState(today())
  const [qHours, setQHours] = useState('')
  const [qDesc, setQDesc] = useState('')
  const [qLoading, setQLoading] = useState(false)

  // Edit modal
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [editForm, setEditForm] = useState<TimeEntryUpdate>({})
  const [editLoading, setEditLoading] = useState(false)

  // Delete
  const [deleteEntry, setDeleteEntry] = useState<TimeEntry | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    projectsService.list({ size: 100 }).then(d => setProjects(d.items)).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    timeEntriesService.list({
      project_id: filterProject ? Number(filterProject) : undefined,
      status: filterStatus as TimeEntryStatus || undefined,
      date_from: filterDateFrom || undefined,
      date_to: filterDateTo || undefined,
      page,
      size: 20,
    })
      .then(setData)
      .catch(() => addToast('error', 'Ошибка загрузки записей'))
      .finally(() => setLoading(false))
  }, [filterProject, filterStatus, filterDateFrom, filterDateTo, page, addToast])

  useEffect(() => { load() }, [load])

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
    } catch {
      addToast('error', 'Ошибка создания записи')
    } finally {
      setQLoading(false)
    }
  }

  const openEdit = (entry: TimeEntry) => {
    setEditEntry(entry)
    setEditForm({ date: entry.date, duration_hours: entry.duration_hours, description: entry.description })
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
    } catch {
      addToast('error', 'Ошибка обновления')
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

  const handleDelete = async () => {
    if (!deleteEntry) return
    setDeleteLoading(true)
    try {
      await timeEntriesService.delete(deleteEntry.id)
      addToast('success', 'Запись удалена')
      setDeleteEntry(null)
      load()
    } catch {
      addToast('error', 'Не удалось удалить запись')
    } finally {
      setDeleteLoading(false)
    }
  }

  const projectName = (id: number) => projects.find(p => p.id === id)?.name ?? `#${id}`

  const columns: Column<TimeEntry>[] = [
    { key: 'date', label: 'Дата' },
    { key: 'project_id', label: 'Проект', render: r => projectName(r.project_id) },
    { key: 'duration_hours', label: 'Часы', render: r => `${r.duration_hours} ч` },
    { key: 'description', label: 'Описание', render: r => r.description ?? '—' },
    { key: 'status', label: 'Статус', render: r => <TimeStatusBadge status={r.status} /> },
    {
      key: 'actions', label: '', render: r => (
        <div className="table-actions">
          {r.status === 'draft' && (
            <Button size="sm" variant="secondary" onClick={() => handleConfirm(r)}>Подтвердить</Button>
          )}
          {r.status !== 'billed' && (
            <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Изм.</Button>
          )}
          {r.status === 'draft' && (
            <Button size="sm" variant="danger" onClick={() => setDeleteEntry(r)}>Удалить</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Quick entry form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title">Быстрое добавление</h2>
        </div>
        <form onSubmit={handleQuickAdd} className="quick-form">
          <Select
            value={qProject}
            onChange={e => setQProject(e.target.value)}
            options={projects.map(p => ({ value: p.id, label: p.name }))}
            placeholder="Проект *"
            required
          />
          <Input type="date" value={qDate} onChange={e => setQDate(e.target.value)} required />
          <Input type="number" step="0.1" min="0.1" placeholder="Часы *" value={qHours}
            onChange={e => setQHours(e.target.value)} required />
          <Input placeholder="Описание" value={qDesc} onChange={e => setQDesc(e.target.value)} />
          <Button type="submit" loading={qLoading}>Добавить</Button>
        </form>
      </div>

      {/* Filters */}
      <div className="page-toolbar">
        <div className="filter-bar">
          <select className="form-input form-select filter-select" value={filterProject}
            onChange={e => { setFilterProject(e.target.value); setPage(1) }}>
            <option value="">Все проекты</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="form-input form-select filter-select" value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="">Все статусы</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="date" className="form-input filter-select" value={filterDateFrom}
            onChange={e => { setFilterDateFrom(e.target.value); setPage(1) }} />
          <input type="date" className="form-input filter-select" value={filterDateTo}
            onChange={e => { setFilterDateTo(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={r => r.id}
          loading={loading}
          emptyMessage="Записи не найдены"
        />
        <Pagination page={page} pages={data?.pages ?? 0} total={data?.total ?? 0} onPageChange={setPage} />
      </div>

      {/* Edit modal */}
      <Modal isOpen={!!editEntry} onClose={() => setEditEntry(null)} title="Редактировать запись" size="sm">
        <form onSubmit={handleEdit}>
          <div className="form-group">
            <label className="form-label">Дата</label>
            <input type="date" className="form-input" value={editForm.date ?? ''}
              onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Часы</label>
            <input type="number" step="0.1" min="0.1" className="form-input"
              value={editForm.duration_hours ?? ''}
              onChange={e => setEditForm(p => ({ ...p, duration_hours: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Описание</label>
            <input className="form-input" value={editForm.description ?? ''}
              onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => setEditEntry(null)}>Отмена</Button>
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
