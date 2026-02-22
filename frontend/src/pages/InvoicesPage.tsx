import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoicesService } from '@/services/invoices'
import { clientsService } from '@/services/clients'
import { timeEntriesService } from '@/services/timeEntries'
import { useToast } from '@/context/ToastContext'
import { Table } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { InvoiceStatusBadge } from '@/components/ui/Badge'
import type { Client, Column, Invoice, InvoiceCreate, InvoiceStatus, Page, TimeEntry } from '@/types'

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

export function InvoicesPage() {
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState<Page<Invoice> | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [filterClient, setFilterClient] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Create invoice modal
  const [showCreate, setShowCreate] = useState(false)
  const [createClient, setCreateClient] = useState('')
  const [confirmedEntries, setConfirmedEntries] = useState<TimeEntry[]>([])
  const [selectedEntries, setSelectedEntries] = useState<number[]>([])
  const [issueDate, setIssueDate] = useState(today())
  const [dueDate, setDueDate] = useState(futureDate(14))
  const [notes, setNotes] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [entriesLoading, setEntriesLoading] = useState(false)

  useEffect(() => {
    clientsService.list({ size: 100 }).then(d => setClients(d.items)).catch(() => {})
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

  useEffect(() => {
    if (!createClient) { setConfirmedEntries([]); return }
    setEntriesLoading(true)
    timeEntriesService.list({ client_id: Number(createClient), status: 'confirmed', size: 100 })
      .then(d => { setConfirmedEntries(d.items); setSelectedEntries([]) })
      .catch(() => {})
      .finally(() => setEntriesLoading(false))
  }, [createClient])

  const toggleEntry = (id: number) =>
    setSelectedEntries(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createClient || selectedEntries.length === 0) {
      addToast('error', 'Выберите клиента и хотя бы одну запись времени')
      return
    }
    setCreateLoading(true)
    const payload: InvoiceCreate = {
      client_id: Number(createClient),
      time_entry_ids: selectedEntries,
      issue_date: issueDate,
      due_date: dueDate,
      notes: notes || null,
    }
    try {
      const inv = await invoicesService.create(payload)
      addToast('success', `Счёт ${inv.invoice_number} создан`)
      setShowCreate(false)
      setCreateClient('')
      setSelectedEntries([])
      setNotes('')
      load()
    } catch {
      addToast('error', 'Ошибка создания счёта')
    } finally {
      setCreateLoading(false)
    }
  }

  const clientName = (id: number) => clients.find(c => c.id === id)?.name ?? `#${id}`

  const columns: Column<Invoice>[] = [
    { key: 'invoice_number', label: '№ Счёта' },
    { key: 'client_id', label: 'Клиент', render: r => clientName(r.client_id) },
    { key: 'issue_date', label: 'Выставлен' },
    { key: 'due_date', label: 'Срок оплаты' },
    { key: 'status', label: 'Статус', render: r => <InvoiceStatusBadge status={r.status} /> },
    { key: 'total_amount', label: 'Сумма', render: r => `${Number(r.total_amount).toLocaleString('ru-RU')} ₽` },
    {
      key: 'actions', label: '', render: r => (
        <Button size="sm" variant="ghost" onClick={() => navigate(`/invoices/${r.id}`)}>
          Открыть →
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div className="page-toolbar">
        <div className="filter-bar">
          <select className="form-input form-select filter-select" value={filterClient}
            onChange={e => { setFilterClient(e.target.value); setPage(1) }}>
            <option value="">Все клиенты</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
        <Button onClick={() => setShowCreate(true)}>+ Создать счёт</Button>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={r => r.id}
          loading={loading}
          emptyMessage="Счета не найдены"
        />
        <Pagination page={page} pages={data?.pages ?? 0} total={data?.total ?? 0} onPageChange={setPage} />
      </div>

      {/* Create invoice modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Создать счёт" size="lg">
        <form onSubmit={handleCreate}>
          <Select
            label="Клиент *"
            value={createClient}
            onChange={e => setCreateClient(e.target.value)}
            options={clients.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Выберите клиента"
            required
          />

          {createClient && (
            <div className="form-group">
              <label className="form-label">Подтверждённые записи времени *</label>
              {entriesLoading ? (
                <p className="loading-text">Загрузка...</p>
              ) : confirmedEntries.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                  Нет подтверждённых записей для этого клиента
                </p>
              ) : (
                <div className="entry-checklist">
                  {confirmedEntries.map(entry => (
                    <label key={entry.id} className="entry-check-item">
                      <input
                        type="checkbox"
                        checked={selectedEntries.includes(entry.id)}
                        onChange={() => toggleEntry(entry.id)}
                      />
                      <span>{entry.date} — {entry.duration_hours} ч</span>
                      {entry.description && <span className="entry-desc">{entry.description}</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Дата выставления *</label>
              <input type="date" className="form-input" value={issueDate}
                onChange={e => setIssueDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Срок оплаты *</label>
              <input type="date" className="form-input" value={dueDate}
                onChange={e => setDueDate(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Примечания</label>
            <textarea className="form-input form-textarea" value={notes}
              onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Отмена</Button>
            <Button type="submit" loading={createLoading}>Создать счёт</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
