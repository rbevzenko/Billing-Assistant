import { useCallback, useEffect, useState } from 'react'
import { clientsService } from '@/services/clients'
import { useToast } from '@/context/ToastContext'
import { Table } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { Client, ClientCreate, Column, Page } from '@/types'

const EMPTY_FORM: ClientCreate = {
  name: '', contact_person: '', email: '', phone: '',
  address: '', inn: '', bank_name: '', bik: '',
  checking_account: '', correspondent_account: '', notes: '',
}

function ClientForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial: ClientCreate
  onSave: (data: ClientCreate) => void
  onCancel: () => void
  loading: boolean
}) {
  const [form, setForm] = useState<ClientCreate>(initial)

  const set = (field: keyof ClientCreate) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-grid">
        <Input label="Название *" value={form.name} onChange={set('name')} required />
        <Input label="Контактное лицо" value={form.contact_person ?? ''} onChange={set('contact_person')} />
        <Input label="Email" type="email" value={form.email ?? ''} onChange={set('email')} />
        <Input label="Телефон" value={form.phone ?? ''} onChange={set('phone')} />
        <Input label="ИНН" value={form.inn ?? ''} onChange={set('inn')} maxLength={12} />
        <Input label="Банк" value={form.bank_name ?? ''} onChange={set('bank_name')} />
        <Input label="БИК" value={form.bik ?? ''} onChange={set('bik')} maxLength={9} />
        <Input label="Расчётный счёт" value={form.checking_account ?? ''} onChange={set('checking_account')} maxLength={20} />
        <Input label="Корр. счёт" value={form.correspondent_account ?? ''} onChange={set('correspondent_account')} maxLength={20} />
      </div>
      <Textarea label="Адрес" value={form.address ?? ''} onChange={set('address')} rows={2} />
      <Textarea label="Примечания" value={form.notes ?? ''} onChange={set('notes')} rows={2} />
      <div className="modal-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>Отмена</Button>
        <Button type="submit" loading={loading}>Сохранить</Button>
      </div>
    </form>
  )
}

export function ClientsPage() {
  const { addToast } = useToast()
  const [data, setData] = useState<Page<Client> | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [deleteClient, setDeleteClient] = useState<Client | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    clientsService.list({ search: search || undefined, page, size: 20 })
      .then(setData)
      .catch(() => addToast('error', 'Ошибка загрузки клиентов'))
      .finally(() => setLoading(false))
  }, [search, page, addToast])

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const handleSave = async (formData: ClientCreate) => {
    setFormLoading(true)
    try {
      if (editClient) {
        await clientsService.update(editClient.id, formData)
        addToast('success', 'Клиент обновлён')
      } else {
        await clientsService.create(formData)
        addToast('success', 'Клиент создан')
      }
      setShowForm(false)
      setEditClient(null)
      load()
    } catch {
      addToast('error', 'Ошибка сохранения')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteClient) return
    setDeleteLoading(true)
    try {
      await clientsService.delete(deleteClient.id)
      addToast('success', 'Клиент удалён')
      setDeleteClient(null)
      load()
    } catch {
      addToast('error', 'Не удалось удалить клиента')
    } finally {
      setDeleteLoading(false)
    }
  }

  const openEdit = (client: Client) => {
    setEditClient(client)
    setShowForm(true)
  }

  const openCreate = () => {
    setEditClient(null)
    setShowForm(true)
  }

  const columns: Column<Client>[] = [
    { key: 'name', label: 'Название' },
    { key: 'contact_person', label: 'Контактное лицо', render: r => r.contact_person ?? '—' },
    { key: 'email', label: 'Email', render: r => r.email ?? '—' },
    { key: 'phone', label: 'Телефон', render: r => r.phone ?? '—' },
    { key: 'inn', label: 'ИНН', render: r => r.inn ?? '—' },
    {
      key: 'actions', label: '', render: r => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Изменить</Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteClient(r)}>Удалить</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-toolbar">
        <input
          className="search-input"
          placeholder="Поиск клиентов..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <Button onClick={openCreate}>+ Добавить клиента</Button>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={r => r.id}
          loading={loading}
          emptyMessage="Клиенты не найдены"
        />
        <Pagination
          page={page}
          pages={data?.pages ?? 0}
          total={data?.total ?? 0}
          onPageChange={setPage}
        />
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditClient(null) }}
        title={editClient ? 'Редактировать клиента' : 'Новый клиент'}
        size="lg"
      >
        <ClientForm
          initial={editClient ? {
            name: editClient.name,
            contact_person: editClient.contact_person,
            email: editClient.email,
            phone: editClient.phone,
            address: editClient.address,
            inn: editClient.inn,
            bank_name: editClient.bank_name,
            bik: editClient.bik,
            checking_account: editClient.checking_account,
            correspondent_account: editClient.correspondent_account,
            notes: editClient.notes,
          } : EMPTY_FORM}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditClient(null) }}
          loading={formLoading}
        />
      </Modal>

      <ConfirmModal
        isOpen={!!deleteClient}
        onClose={() => setDeleteClient(null)}
        onConfirm={handleDelete}
        title="Удалить клиента"
        message={`Вы уверены, что хотите удалить клиента «${deleteClient?.name}»?`}
        loading={deleteLoading}
      />
    </div>
  )
}
