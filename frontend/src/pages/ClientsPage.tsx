import { useCallback, useEffect, useRef, useState } from 'react'
import { clientsService } from '@/services/clients'
import { useToast } from '@/context/ToastContext'
import { useLanguage } from '@/i18n/translations'
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
  const { t } = useLanguage()
  const [form, setForm] = useState<ClientCreate>(initial)
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  const set = (field: keyof ClientCreate) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-grid">
        <Input ref={firstRef} label={t.clients.nameLabel} value={form.name} onChange={set('name')} required />
        <Input label={t.clients.contactLabel} value={form.contact_person ?? ''} onChange={set('contact_person')} />
        <Input label="Email" type="email" value={form.email ?? ''} onChange={set('email')} />
        <Input label={t.clients.phoneLabel} value={form.phone ?? ''} onChange={set('phone')} />
        <Input label={t.clients.innLabel} value={form.inn ?? ''} onChange={set('inn')} maxLength={12} />
        <Input label={t.clients.bankLabel} value={form.bank_name ?? ''} onChange={set('bank_name')} />
        <Input label={t.clients.bikLabel} value={form.bik ?? ''} onChange={set('bik')} maxLength={9} />
        <Input label={t.clients.accountLabel} value={form.checking_account ?? ''} onChange={set('checking_account')} maxLength={20} />
        <Input label={t.clients.corrAccountLabel} value={form.correspondent_account ?? ''} onChange={set('correspondent_account')} maxLength={20} />
      </div>
      <Textarea label={t.clients.addressLabel} value={form.address ?? ''} onChange={set('address')} rows={2} />
      <Textarea label={t.clients.notesLabel} value={form.notes ?? ''} onChange={set('notes')} rows={2} />
      <div className="modal-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>{t.common.cancel}</Button>
        <Button type="submit" loading={loading}>{t.common.save}</Button>
      </div>
    </form>
  )
}

export function ClientsPage() {
  const { addToast } = useToast()
  const { t } = useLanguage()
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
      .catch(() => addToast('error', t.common.error))
      .finally(() => setLoading(false))
  }, [search, page, addToast, t])

  useEffect(() => {
    const timer = setTimeout(load, search ? 400 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  const handleSave = async (formData: ClientCreate) => {
    setFormLoading(true)
    try {
      if (editClient) {
        await clientsService.update(editClient.id, formData)
        addToast('success', t.clients.updatedToast)
      } else {
        await clientsService.create(formData)
        addToast('success', t.clients.createdToast)
      }
      setShowForm(false)
      setEditClient(null)
      load()
    } catch (err: any) {
      addToast('error', err.message || t.common.error)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteClient) return
    setDeleteLoading(true)
    try {
      await clientsService.delete(deleteClient.id)
      addToast('success', t.clients.deletedToast)
      setDeleteClient(null)
      load()
    } catch (err: any) {
      addToast('error', err.message || t.common.error)
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
    { key: 'name', label: t.clients.nameCol },
    { key: 'contact_person', label: t.clients.contactCol, render: r => r.contact_person ?? '—' },
    { key: 'email', label: 'Email', render: r => r.email ?? '—' },
    { key: 'phone', label: t.clients.phoneCol, render: r => r.phone ?? '—' },
    { key: 'inn', label: t.clients.innCol, render: r => r.inn ?? '—' },
    {
      key: 'actions', label: '', render: r => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>{t.common.edit}</Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteClient(r)}>{t.common.delete}</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-toolbar">
        <input
          className="search-input"
          placeholder={t.clients.searchPlaceholder}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <Button onClick={openCreate}>{t.clients.addBtn}</Button>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={r => r.id}
          loading={loading}
          emptyMessage={t.clients.emptyMessage}
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
        title={editClient ? t.clients.editModal : t.clients.createModal}
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
        title={t.clients.deleteTitle}
        message={`${t.clients.deleteConfirm} «${deleteClient?.name}»? ${t.clients.deleteConfirm2}`}
        loading={deleteLoading}
      />
    </div>
  )
}
