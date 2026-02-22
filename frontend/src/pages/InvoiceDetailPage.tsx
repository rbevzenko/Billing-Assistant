import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { invoicesService } from '@/services/invoices'
import { clientsService } from '@/services/clients'
import { profileService } from '@/services/profile'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { InvoiceStatusBadge } from '@/components/ui/Badge'
import type { Client, Invoice, LawyerProfile } from '@/types'

function fmt(n: string | number) {
  return Number(n).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('ru-RU')
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [profile, setProfile] = useState<LawyerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    invoicesService.get(Number(id))
      .then(async inv => {
        setInvoice(inv)
        const [cl, pr] = await Promise.all([
          clientsService.get(inv.client_id),
          profileService.get(),
        ])
        setClient(cl)
        setProfile(pr)
      })
      .catch(() => addToast('error', 'Счёт не найден'))
      .finally(() => setLoading(false))
  }, [id, addToast])

  const handleSend = async () => {
    if (!invoice) return
    setActionLoading(true)
    try {
      setInvoice(await invoicesService.send(invoice.id))
      addToast('success', 'Статус изменён: Отправлен')
    } catch {
      addToast('error', 'Ошибка')
    } finally {
      setActionLoading(false)
    }
  }

  const handlePay = async () => {
    if (!invoice) return
    setActionLoading(true)
    try {
      setInvoice(await invoicesService.pay(invoice.id))
      addToast('success', 'Статус изменён: Оплачен')
    } catch {
      addToast('error', 'Ошибка')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!invoice) return
    setActionLoading(true)
    try {
      await invoicesService.delete(invoice.id)
      addToast('success', 'Счёт удалён')
      navigate('/invoices')
    } catch {
      addToast('error', 'Не удалось удалить счёт')
      setActionLoading(false)
    }
  }

  if (loading) return <div className="loading-text">Загрузка...</div>
  if (!invoice) return <div className="loading-text">Счёт не найден</div>

  const total = Number(invoice.total_amount)
  const totalHours = invoice.items.reduce((s, i) => s + Number(i.hours), 0)

  return (
    <div className="invoice-detail">
      {/* ── Action bar (hidden on print) ────────────────────────────────────── */}
      <div className="invoice-action-bar no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
          ← Назад
        </Button>
        <div className="table-actions">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            ⬇ Скачать PDF
          </Button>
          {invoice.status === 'draft' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSend}
                loading={actionLoading}
              >
                Отправлен ✓
              </Button>
              <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
                Удалить
              </Button>
            </>
          )}
          {invoice.status === 'sent' && (
            <Button variant="primary" size="sm" onClick={handlePay} loading={actionLoading}>
              Оплачен ✓
            </Button>
          )}
        </div>
      </div>

      {/* ── Invoice document ────────────────────────────────────────────────── */}
      <div className="card invoice-doc" id="invoice-print-area">
        {/* Header: number + status */}
        <div className="invoice-doc-header">
          <div>
            <h1 className="invoice-doc-title">Счёт {invoice.invoice_number}</h1>
            <div style={{ marginTop: 6 }}>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
          </div>
          <div className="invoice-doc-dates">
            <div className="invoice-meta-item">
              <span className="invoice-meta-label">Дата выставления</span>
              <span>{fmtDate(invoice.issue_date)}</span>
            </div>
            <div className="invoice-meta-item">
              <span className="invoice-meta-label">Срок оплаты</span>
              <span>{fmtDate(invoice.due_date)}</span>
            </div>
          </div>
        </div>

        {/* Parties: lawyer ↔ client */}
        <div className="invoice-parties">
          <div className="invoice-party">
            <div className="invoice-party-label">Исполнитель</div>
            {profile ? (
              <>
                <div className="invoice-party-name">
                  {profile.company_name || profile.full_name}
                </div>
                {profile.company_name && profile.full_name && (
                  <div className="invoice-party-row">{profile.full_name}</div>
                )}
                {profile.inn && (
                  <div className="invoice-party-row">ИНН: {profile.inn}</div>
                )}
                {profile.address && (
                  <div className="invoice-party-row">{profile.address}</div>
                )}
                {profile.phone && (
                  <div className="invoice-party-row">{profile.phone}</div>
                )}
                {profile.email && (
                  <div className="invoice-party-row">{profile.email}</div>
                )}
                {(profile.bank_name || profile.bik || profile.checking_account) && (
                  <div className="invoice-party-bank">
                    {profile.bank_name && <div>{profile.bank_name}</div>}
                    {profile.bik && <div>БИК: {profile.bik}</div>}
                    {profile.checking_account && (
                      <div>Р/с: {profile.checking_account}</div>
                    )}
                    {profile.correspondent_account && (
                      <div>К/с: {profile.correspondent_account}</div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="invoice-party-row" style={{ color: 'var(--text-muted)' }}>
                Профиль не заполнен
              </div>
            )}
          </div>

          <div className="invoice-party">
            <div className="invoice-party-label">Заказчик</div>
            {client ? (
              <>
                <div className="invoice-party-name">{client.name}</div>
                {client.contact_person && (
                  <div className="invoice-party-row">{client.contact_person}</div>
                )}
                {client.inn && (
                  <div className="invoice-party-row">ИНН: {client.inn}</div>
                )}
                {client.address && (
                  <div className="invoice-party-row">{client.address}</div>
                )}
                {client.phone && (
                  <div className="invoice-party-row">{client.phone}</div>
                )}
                {client.email && (
                  <div className="invoice-party-row">{client.email}</div>
                )}
                {(client.bank_name || client.bik || client.checking_account) && (
                  <div className="invoice-party-bank">
                    {client.bank_name && <div>{client.bank_name}</div>}
                    {client.bik && <div>БИК: {client.bik}</div>}
                    {client.checking_account && (
                      <div>Р/с: {client.checking_account}</div>
                    )}
                    {client.correspondent_account && (
                      <div>К/с: {client.correspondent_account}</div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="invoice-party-row" style={{ color: 'var(--text-muted)' }}>
                Загрузка...
              </div>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div className="invoice-notes">
            <span className="invoice-notes-label">Примечания:</span> {invoice.notes}
          </div>
        )}

        {/* Items table */}
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Проект</th>
                <th>Описание</th>
                <th>Часы</th>
                <th>Ставка, ₽/ч</th>
                <th>Сумма, ₽</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr key={item.id}>
                  <td>{item.date ? fmtDate(item.date) : `Позиция ${idx + 1}`}</td>
                  <td>{item.project_name ?? '—'}</td>
                  <td className="td-desc">{item.description ?? '—'}</td>
                  <td className="td-num">{Number(item.hours).toFixed(1)}</td>
                  <td className="td-num">{fmt(item.rate)}</td>
                  <td className="td-num">{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-total-row">
                <td colSpan={3} className="total-label">Итого:</td>
                <td className="td-num total-value">{totalHours.toFixed(1)} ч</td>
                <td />
                <td className="td-num total-value">{fmt(total)} ₽</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="invoice-doc-footer">
          <div className="invoice-total-block">
            <span className="invoice-total-label">ИТОГО К ОПЛАТЕ:</span>
            <span className="invoice-total-sum">{fmt(total)} ₽</span>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Удалить счёт"
        message={`Удалить счёт ${invoice.invoice_number}? Записи времени вернутся в статус «Подтверждён».`}
        loading={actionLoading}
      />
    </div>
  )
}
