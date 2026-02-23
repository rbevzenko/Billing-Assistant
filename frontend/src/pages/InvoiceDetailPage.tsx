import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { invoicesService } from '@/services/invoices'
import { clientsService } from '@/services/clients'
import { profileService } from '@/services/profile'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { InvoiceStatusBadge } from '@/components/ui/Badge'
import { CURRENCY_SYMBOL } from '@/services/exchange'
import { TRANSLATIONS } from '@/i18n/translations'
import type { Client, Invoice, LawyerProfile } from '@/types'

function fmtDate(s: string, lang: 'ru' | 'en') {
  return new Date(s + 'T00:00:00').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')
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
  const [pdfLoading, setPdfLoading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    invoicesService.get(Number(id))
      .then(async inv => {
        setInvoice(inv)
        const [cl, pr] = await Promise.all([
          clientsService.get(inv.client_id),
          profileService.getById(inv.profile_id),
        ])
        setClient(cl)
        setProfile(pr ?? await profileService.getActive())
      })
      .catch(() => addToast('error', 'Счёт не найден'))
      .finally(() => setLoading(false))
  }, [id, addToast])

  const handleSend = async () => {
    if (!invoice) return
    setActionLoading(true)
    try { setInvoice(await invoicesService.send(invoice.id)); addToast('success', 'Статус: Отправлен') }
    catch { addToast('error', 'Ошибка') }
    finally { setActionLoading(false) }
  }

  const handlePay = async () => {
    if (!invoice) return
    setActionLoading(true)
    try { setInvoice(await invoicesService.pay(invoice.id)); addToast('success', 'Статус: Оплачен') }
    catch { addToast('error', 'Ошибка') }
    finally { setActionLoading(false) }
  }

  const handleDelete = async () => {
    if (!invoice) return
    setActionLoading(true)
    try { await invoicesService.delete(invoice.id); addToast('success', 'Счёт удалён'); navigate('/invoices') }
    catch { addToast('error', 'Не удалось удалить счёт'); setActionLoading(false) }
  }

  const handleDownloadPdf = useCallback(async () => {
    if (!invoice) return
    setPdfLoading(true)
    try { await invoicesService.downloadPdf(invoice.id, invoice.invoice_number) }
    catch { addToast('error', 'Ошибка генерации PDF') }
    finally { setPdfLoading(false) }
  }, [invoice, addToast])

  if (loading) return <div className="loading-text">Загрузка...</div>
  if (!invoice) return <div className="loading-text">Счёт не найден</div>

  const lang = profile?.language ?? 'ru'
  const T = TRANSLATIONS[lang]
  const sym = CURRENCY_SYMBOL[invoice.currency ?? 'RUB']
  const fmt = (n: string | number) =>
    `${Number(n).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2 })} ${sym}`

  const total = Number(invoice.total_amount)
  const totalHours = invoice.items.reduce((s, i) => s + Number(i.hours), 0)
  const showVat = invoice.vat_type === 'vat10' || invoice.vat_type === 'vat22'
  const vatLabel = T.vat[invoice.vat_type]

  const isEu = profile?.type === 'eu'

  return (
    <div className="invoice-detail">
      <div className="invoice-action-bar no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>← Назад</Button>
        <div className="table-actions">
          <Button variant="secondary" size="sm" onClick={handleDownloadPdf} loading={pdfLoading}>⬇ Скачать PDF</Button>
          {invoice.status === 'draft' && (
            <Button variant="secondary" size="sm" onClick={handleSend} loading={actionLoading}>Отправлен ✓</Button>
          )}
          <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>Удалить</Button>
          {invoice.status === 'sent' && (
            <Button variant="primary" size="sm" onClick={handlePay} loading={actionLoading}>Оплачен ✓</Button>
          )}
        </div>
      </div>

      <div className="card invoice-doc" id="invoice-print-area">
        <div className="invoice-doc-header">
          <div>
            <h1 className="invoice-doc-title">{T.invoice.invoice} {invoice.invoice_number}</h1>
            <div style={{ marginTop: 6 }}><InvoiceStatusBadge status={invoice.status} /></div>
          </div>
          <div className="invoice-doc-dates">
            <div className="invoice-meta-item">
              <span className="invoice-meta-label">{T.invoice.issueDate}</span>
              <span>{fmtDate(invoice.issue_date, lang)}</span>
            </div>
            <div className="invoice-meta-item">
              <span className="invoice-meta-label">{T.invoice.dueDate}</span>
              <span>{fmtDate(invoice.due_date, lang)}</span>
            </div>
          </div>
        </div>

        <div className="invoice-parties">
          <div className="invoice-party">
            <div className="invoice-party-label">{T.invoice.issuer}</div>
            {profile ? (
              <>
                <div className="invoice-party-name">{profile.company_name || profile.full_name}</div>
                {profile.company_name && profile.full_name && <div className="invoice-party-row">{profile.full_name}</div>}
                {!isEu && profile.inn && <div className="invoice-party-row">{T.invoice.inn}: {profile.inn}</div>}
                {isEu && profile.vat_number && <div className="invoice-party-row">{T.invoice.vatNumber}: {profile.vat_number}</div>}
                {profile.address && <div className="invoice-party-row">{profile.address}</div>}
                {profile.phone && <div className="invoice-party-row">{profile.phone}</div>}
                {profile.email && <div className="invoice-party-row">{profile.email}</div>}
                {isEu ? (
                  <div className="invoice-party-bank">
                    {profile.iban && <div>{T.invoice.iban}: {profile.iban}</div>}
                    {profile.swift && <div>{T.invoice.swift}: {profile.swift}</div>}
                    {profile.bank_name && <div>{profile.bank_name}</div>}
                    {profile.bank_country && <div>{T.invoice.country}: {profile.bank_country}</div>}
                  </div>
                ) : (
                  (profile.bank_name || profile.bik || profile.checking_account) && (
                    <div className="invoice-party-bank">
                      {profile.bank_name && <div>{profile.bank_name}</div>}
                      {profile.bik && <div>{T.invoice.bik}: {profile.bik}</div>}
                      {profile.checking_account && <div>{T.invoice.account}: {profile.checking_account}</div>}
                      {profile.correspondent_account && <div>{T.invoice.corrAccount}: {profile.correspondent_account}</div>}
                    </div>
                  )
                )}
              </>
            ) : (
              <div className="invoice-party-row" style={{ color: 'var(--text-muted)' }}>{T.invoice.notFilled}</div>
            )}
          </div>

          <div className="invoice-party">
            <div className="invoice-party-label">{T.invoice.client}</div>
            {client ? (
              <>
                <div className="invoice-party-name">{client.name}</div>
                {client.contact_person && <div className="invoice-party-row">{client.contact_person}</div>}
                {client.inn && <div className="invoice-party-row">{T.invoice.inn}: {client.inn}</div>}
                {client.address && <div className="invoice-party-row">{client.address}</div>}
                {client.phone && <div className="invoice-party-row">{client.phone}</div>}
                {client.email && <div className="invoice-party-row">{client.email}</div>}
                {(client.bank_name || client.bik || client.checking_account) && (
                  <div className="invoice-party-bank">
                    {client.bank_name && <div>{client.bank_name}</div>}
                    {client.bik && <div>{T.invoice.bik}: {client.bik}</div>}
                    {client.checking_account && <div>{T.invoice.account}: {client.checking_account}</div>}
                    {client.correspondent_account && <div>{T.invoice.corrAccount}: {client.correspondent_account}</div>}
                  </div>
                )}
              </>
            ) : (
              <div className="invoice-party-row" style={{ color: 'var(--text-muted)' }}>Загрузка...</div>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div className="invoice-notes">
            <span className="invoice-notes-label">{T.invoice.notes}:</span> {invoice.notes}
          </div>
        )}

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{T.invoice.date}</th>
                <th>{T.invoice.project}</th>
                <th>{T.invoice.description}</th>
                <th>{T.invoice.hours}</th>
                <th>{T.invoice.rate}, {sym}/h</th>
                <th>{T.invoice.amount}, {sym}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr key={item.id}>
                  <td>{item.date ? fmtDate(item.date, lang) : `${idx + 1}`}</td>
                  <td>{item.project_name ?? '—'}</td>
                  <td className="td-desc">{item.description ?? '—'}</td>
                  <td className="td-num">{Number(item.hours).toFixed(1)}</td>
                  <td className="td-num">{Number(item.rate).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="td-num">{Number(item.amount).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-total-row">
                <td colSpan={3} className="total-label">{lang === 'ru' ? 'Итого:' : 'Subtotal:'}</td>
                <td className="td-num total-value">{totalHours.toFixed(1)} h</td>
                <td />
                <td className="td-num total-value">{fmt(invoice.subtotal ?? invoice.total_amount)}</td>
              </tr>
              {showVat && (
                <tr className="table-total-row">
                  <td colSpan={5} className="total-label">{vatLabel}:</td>
                  <td className="td-num total-value">{fmt(invoice.vat_amount ?? '0')}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        <div className="invoice-doc-footer">
          <div className="invoice-total-block">
            <span className="invoice-total-label">{T.invoice.total}:</span>
            <span className="invoice-total-sum">{fmt(total)}</span>
          </div>
          {invoice.payment_currency && invoice.payment_amount && invoice.exchange_rate && (
            <div style={{ textAlign: 'right', marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              {T.invoice.paymentTotal} {invoice.payment_currency}:&nbsp;
              {Number(invoice.payment_amount).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2 })} {CURRENCY_SYMBOL[invoice.payment_currency]}
              &nbsp;({T.invoice.atRate}: {invoice.exchange_rate.toFixed(4)})
            </div>
          )}
          {!showVat && invoice.vat_type !== 'none' && (
            <div style={{ textAlign: 'right', marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              {vatLabel}
            </div>
          )}
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
