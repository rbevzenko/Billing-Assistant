import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsService } from '@/services/projects'
import { clientsService } from '@/services/clients'
import { invoicesService } from '@/services/invoices'
import { useToast } from '@/context/ToastContext'
import { useLanguage } from '@/i18n/translations'
import { CURRENCY_SYMBOL } from '@/services/exchange'
import { Table } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { ProjectStatusBadge } from '@/components/ui/Badge'
import type { Client, Column, Currency, Page, Project, ProjectAdvanceBalance, ProjectCreate, ProjectStatus } from '@/types'

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: 'RUB', label: 'RUB ₽' },
  { value: 'USD', label: 'USD $' },
  { value: 'EUR', label: 'EUR €' },
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
  const { t } = useLanguage()
  const [form, setForm] = useState<ProjectCreate>(initial)
  const nameRef = useRef<HTMLInputElement>(null)

  const STATUS_OPTIONS = [
    { value: 'active', label: t.status.active },
    { value: 'paused', label: t.status.paused },
    { value: 'completed', label: t.status.completed },
  ]

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const set = (field: keyof ProjectCreate) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  if (clients.length === 0) {
    return (
      <div style={{ padding: '16px 0' }}>
        <p style={{ marginBottom: 12 }}>{t.projects.noClientMsg}</p>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onCancel}>{t.common.cancel}</Button>
          <Button type="button" onClick={() => { onCancel(); navigate('/clients') }}>
            {t.projects.goToClients}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-grid">
        <Select
          label={t.projects.clientLabel}
          value={form.client_id}
          onChange={e => setForm(prev => ({ ...prev, client_id: Number(e.target.value) }))}
          options={clients.map(c => ({ value: c.id, label: c.name }))}
          placeholder={t.projects.selectClient}
          required
        />
        <Input ref={nameRef} label={t.projects.nameLabel} value={form.name} onChange={set('name')} required />
        <Input label={t.projects.rateLabel} type="number" step="0.01" min="0"
          value={form.hourly_rate ?? ''} onChange={set('hourly_rate')} />
        <Select
          label={t.projects.currencyLabel}
          value={form.currency ?? 'RUB'}
          onChange={e => setForm(prev => ({ ...prev, currency: e.target.value as Currency }))}
          options={CURRENCY_OPTIONS}
        />
        <Select
          label={t.projects.statusLabel}
          value={form.status ?? 'active'}
          onChange={e => setForm(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
          options={STATUS_OPTIONS}
        />
      </div>
      <Textarea label={t.projects.descLabel} value={form.description ?? ''} onChange={set('description')} rows={3} />
      <div className="modal-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>{t.common.cancel}</Button>
        <Button type="submit" loading={loading}>{t.common.save}</Button>
      </div>
    </form>
  )
}

export function ProjectsPage() {
  const { addToast } = useToast()
  const { t, lang } = useLanguage()
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
  const [advanceBalances, setAdvanceBalances] = useState<Record<number, ProjectAdvanceBalance>>({})

  const STATUS_OPTIONS = [
    { value: 'active', label: t.status.active },
    { value: 'paused', label: t.status.paused },
    { value: 'completed', label: t.status.completed },
  ]

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
      .then(d => {
        setData(d)
        const ids = d.items.map(p => p.id)
        invoicesService.getProjectAdvanceBalances(ids)
          .then(setAdvanceBalances)
          .catch(() => {})
      })
      .catch(() => addToast('error', t.common.error))
      .finally(() => setLoading(false))
  }, [filterClient, filterStatus, page, addToast, t])

  useEffect(() => { load() }, [load])

  const handleSave = async (formData: ProjectCreate) => {
    setFormLoading(true)
    try {
      if (editProject) {
        const { client_id: _cid, ...upd } = formData
        await projectsService.update(editProject.id, upd)
        addToast('success', t.projects.updatedToast)
      } else {
        await projectsService.create(formData)
        addToast('success', t.projects.createdToast)
      }
      setShowForm(false)
      setEditProject(null)
      load()
    } catch (err: any) {
      addToast('error', err.message || t.common.error)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteProject) return
    setDeleteLoading(true)
    try {
      await projectsService.delete(deleteProject.id)
      addToast('success', t.projects.deletedToast)
      setDeleteProject(null)
      load()
    } catch (err: any) {
      addToast('error', err.message || t.common.error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const clientName = (id: number) => clients.find(c => c.id === id)?.name ?? `#${id}`
  const locale = lang === 'en' ? 'en-US' : 'ru-RU'
  const fmtAdv = (n: number, cur: Currency) =>
    `${n.toLocaleString(locale, { maximumFractionDigits: 0 })} ${CURRENCY_SYMBOL[cur]}`

  const columns: Column<Project>[] = [
    { key: 'name', label: t.projects.nameCol },
    { key: 'client_id', label: t.projects.clientCol, render: r => clientName(r.client_id) },
    { key: 'status', label: t.projects.statusCol, render: r => <ProjectStatusBadge status={r.status} /> },
    { key: 'hourly_rate', label: t.projects.rateCol, render: r => r.hourly_rate ? `${r.hourly_rate} ${r.currency ?? 'RUB'}` : '—' },
    {
      key: 'advance', label: t.projects.advanceCol, render: r => {
        const adv = advanceBalances[r.id]
        if (!adv) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        const cur = (r.currency ?? 'RUB') as Currency
        if (adv.balance <= 0) {
          return <span className="badge badge-neutral">{t.projects.advanceUsed}</span>
        }
        return (
          <span style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t.projects.advancePaid}: {fmtAdv(adv.paid, cur)}</span>
            <br />
            <span className="badge badge-advance" style={{ marginTop: 2 }}>{t.projects.advanceBalance}: {fmtAdv(adv.balance, cur)}</span>
          </span>
        )
      },
    },
    {
      key: 'actions', label: '', render: r => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" onClick={() => { setEditProject(r); setShowForm(true) }}>{t.common.edit}</Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteProject(r)}>{t.common.delete}</Button>
        </div>
      ),
    },
  ]

  const emptyForm: ProjectCreate = { client_id: 0, name: '', status: 'active', currency: 'RUB' }

  return (
    <div>
      <div className="page-toolbar">
        <div className="filter-bar">
          <select
            className="form-input form-select filter-select"
            value={filterClient}
            onChange={e => { setFilterClient(e.target.value); setPage(1) }}
          >
            <option value="">{t.common.allClients}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            className="form-input form-select filter-select"
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          >
            <option value="">{t.common.allStatuses}</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <Button onClick={() => { setEditProject(null); setShowForm(true) }}>{t.projects.addBtn}</Button>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={r => r.id}
          loading={loading}
          emptyMessage={t.projects.emptyMessage}
        />
        <Pagination page={page} pages={data?.pages ?? 0} total={data?.total ?? 0} onPageChange={setPage} />
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditProject(null) }}
        title={editProject ? t.projects.editModal : t.projects.createModal}
        size="md"
      >
        <ProjectForm
          initial={editProject ? {
            client_id: editProject.client_id,
            name: editProject.name,
            description: editProject.description,
            hourly_rate: editProject.hourly_rate,
            currency: editProject.currency ?? 'RUB',
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
        title={t.projects.deleteTitle}
        message={`${t.projects.deleteTitle} «${deleteProject?.name}»? ${t.projects.deleteConfirm}`}
        loading={deleteLoading}
      />
    </div>
  )
}
