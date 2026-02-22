import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { invoicesService } from '@/services/invoices'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { InvoiceStatusBadge } from '@/components/ui/Badge'
import type { Invoice } from '@/types'

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (!id) return
    invoicesService.get(Number(id))
      .then(setInvoice)
      .catch(() => addToast('error', 'Счёт не найден'))
      .finally(() => setLoading(false))
  }, [id, addToast])

  const handleSend = async () => {
    if (!invoice) return
    setActionLoading(true)
    try {
      const updated = await invoicesService.send(invoice.id)
      setInvoice(updated)
      addToast('success', 'Счёт отправлен')
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
      const updated = await invoicesService.pay(invoice.id)
      setInvoice(updated)
      addToast('success', 'Счёт отмечен как оплаченный')
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

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">{invoice.invoice_number}</h2>
            <div style={{ marginTop: 4 }}>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
          </div>
          <div className="table-actions">
            {invoice.status === 'draft' && (
              <>
                <Button variant="secondary" size="sm" onClick={handleSend} loading={actionLoading}>
                  Отправить
                </Button>
                <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
                  Удалить
                </Button>
              </>
            )}
            {invoice.status === 'sent' && (
              <Button variant="primary" size="sm" onClick={handlePay} loading={actionLoading}>
                Отметить оплаченным
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
              ← Назад
            </Button>
          </div>
        </div>

        <div className="invoice-meta">
          <div className="invoice-meta-item">
            <span className="invoice-meta-label">Дата выставления</span>
            <span>{invoice.issue_date}</span>
          </div>
          <div className="invoice-meta-item">
            <span className="invoice-meta-label">Срок оплаты</span>
            <span>{invoice.due_date}</span>
          </div>
          <div className="invoice-meta-item">
            <span className="invoice-meta-label">Создан</span>
            <span>{new Date(invoice.created_at).toLocaleDateString('ru-RU')}</span>
          </div>
        </div>

        {invoice.notes && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 6 }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Примечания: </span>
            {invoice.notes}
          </div>
        )}
      </div>

      {/* Items table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Позиции счёта</h3>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Часы</th>
                <th>Ставка (₽/ч)</th>
                <th>Сумма (₽)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map(item => (
                <tr key={item.id}>
                  <td>{item.hours} ч</td>
                  <td>{Number(item.rate).toLocaleString('ru-RU')}</td>
                  <td>{Number(item.amount).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-total-row">
                <td colSpan={2}><strong>Итого</strong></td>
                <td><strong>{total.toLocaleString('ru-RU')} ₽</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Удалить счёт"
        message={`Вы уверены, что хотите удалить счёт ${invoice.invoice_number}? Записи времени вернутся в статус «Подтверждён».`}
        loading={actionLoading}
      />
    </div>
  )
}
