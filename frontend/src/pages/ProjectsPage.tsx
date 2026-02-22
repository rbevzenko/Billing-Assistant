import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsService } from '@/services/projects'
import { clientsService } from '@/services/clients'
import { useToast } from '@/context/ToastContext'
import { Table } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { ProjectStatusBadge } from '@/components/ui/Badge'
import type { Client, Column, Page, Project, ProjectCreate, ProjectStatus } from '@/types'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Активный' },
  { value: 'paused', label: 'Приостановлен' },
  { value: 'completed', label: 'Завершён' },
]

function ProjectForm({
  initial,
  clients,
  onSave,
  onCancel,
  loading,
}: {
  initial: ProjectCreate
  clients: Client[]
  onSave: (data: ProjectCreate) => void
  onCancel: () => void
  loading: boolean
}) {
  const navigate = useNavigate()
  const [form, setForm] = useState<ProjectCreate>(initial)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const set = (field: keyof ProjectCreate) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  if (clients.length === 0) {
    return (
      <div style={{ padding: '16px 0' }}>
        <p style={{ marginBottom: 12 }}>Сначала создайте хотя бы одного клиента.</p>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onCancel}>Отмена</Button>
          <Button type="button" onClick={() => { onCancel(); navigate('/clients') }}>
            Перейти к клиентам
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-grid">
        <Select
          label="Клиент *"
          value={form.client_id}
          onChange={e => setForm(prev => ({ ...prev, client_id: Number(e.target.value) }))}
          options={clients.map(c => ({ value: c.id, label: c.name }))}
          placeholder="Выберите клиента"
          required
        />
        <Input ref={nameRef} label="Название *" value={form.name} onChange={set('name')} required />
        <Input label="Ставка руб/час" type="number" step="0.01" min="0"
          value={form.hourly_rate ?? ''} onChange={set('hourly_rate')} />
        <Select
          label="Статус"
          value={form.status ?? 'active'}
          onChange={e => setForm(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
          options={STATUS_OPTIONS}
        />
      </div>
      <Textarea label="Описание" value={form.description ?? ''} onChange={set('description')} rows={3} />
      <div className="modal-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>Отмена</Button>
        <Button type="submit" loading={loading}>Сохранить</Button>
      </div>
    </form>
  )
}

export function ProjectsPage() {
  const { addToast } = useToast()
  const [data, setData] = useState<Page<Project> | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [filterClient, setFilterClient] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [deleteProject, setDeleteProject] = useState<Project | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    clientsService.list({ size: 100 }).then(d => setClients(d.items)).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    projectsService.list({
      client_id: filterClient ? Number(filterClient) : undefined,
      status: filterStatus as ProjectStatus || undefined,
      page,
      size: 20,
    })
      .then(setData)
      .catch(() => addToast('error', 'Ошибка загрузки проектов'))
      .finally(() => setLoading(false))
  }, [filterClient, filterStatus, page, addToast])

  useEffect(() => { load() }, [load])

  const handleSave = async (formData: ProjectCreate) => {
    setFormLoading(true)
    try {
      if (editProject) {
        const { client_id: _cid, ...upd } = formData
        await projectsService.update(editProject.id, upd)
        addToast('success', 'Проект обновлён')
      } else {
        await projectsService.create(formData)
        addToast('success', 'Проект создан')
      }
      setShowForm(false)
      setEditProject(null)
      load()
    } catch (err: any) {
      addToast('error', err.message || 'Ошибка сохранения')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteProject) return
    setDeleteLoading(true)
    try {
      await projectsService.delete(deleteProject.id)
      addToast('success', 'Проект удалён')
      setDeleteProject(null)
      load()
    } catch (err: any) {
      addToast('error', err.message || 'Не удалось удалить проект')
    } finally {
      setDeleteLoading(false)
    }
  }

  const clientName = (id: number) => clients.find(c => c.id === id)?.name ?? `#${id}`

  const columns: Column<Project>[] = [
    { key: 'name', label: 'Название' },
    { key: 'client_id', label: 'Клиент', render: r => clientName(r.client_id) },
    { key: 'status', label: 'Статус', render: r => <ProjectStatusBadge status={r.status} /> },
    { key: 'hourly_rate', label: 'Ставка руб/ч', render: r => r.hourly_rate ? `${r.hourly_rate} ₽` : '—' },
    {
      key: 'actions', label: '', render: r => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" onClick={() => { setEditProject(r); setShowForm(true) }}>Изменить</Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteProject(r)}>Удалить</Button>
        </div>
      ),
    },
  ]

  const emptyForm: ProjectCreate = { client_id: 0, name: '', status: 'active' }

  return (
    <div>
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
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <Button onClick={() => { setEditProject(null); setShowForm(true) }}>+ Добавить проект</Button>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={r => r.id}
          loading={loading}
          emptyMessage="Проекты не найдены. Нажмите «+ Добавить проект» чтобы начать."
        />
        <Pagination page={page} pages={data?.pages ?? 0} total={data?.total ?? 0} onPageChange={setPage} />
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditProject(null) }}
        title={editProject ? 'Редактировать проект' : 'Новый проект'}
        size="md"
      >
        <ProjectForm
          initial={editProject ? {
            client_id: editProject.client_id,
            name: editProject.name,
            description: editProject.description,
            hourly_rate: editProject.hourly_rate,
            status: editProject.status,
          } : emptyForm}
          clients={clients}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditProject(null) }}
          loading={formLoading}
        />
      </Modal>

      <ConfirmModal
        isOpen={!!deleteProject}
        onClose={() => setDeleteProject(null)}
        onConfirm={handleDelete}
        title="Удалить проект"
        message={`Удалить проект «${deleteProject?.name}»? Все записи времени этого проекта будут удалены.`}
        loading={deleteLoading}
      />
    </div>
  )
}
