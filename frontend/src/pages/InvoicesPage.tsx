import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoicesService } from '@/services/invoices'
import { clientsService } from '@/services/clients'
import { projectsService } from '@/services/projects'
import { timeEntriesService } from '@/services/timeEntries'
import { profileService } from '@/services/profile'
import { useToast } from '@/context/ToastContext'
import { useLanguage } from '@/i18n/translations'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { InvoiceStatusBadge } from '@/components/ui/Badge'
import { CURRENCY_SYMBOL } from '@/services/exchange'
import type {
  Client, Currency, Invoice, InvoiceCreate, InvoiceStatus, InvoiceType,
  LawyerProfile, Page, Project, TimeEntry, VatType,
} from '@/types'

const CURRENCY_OPTIONS: Currency[] = ['RUB', 'USD', 'EUR']

const today = () => new Date().toISOString().slice(0, 10)
const futureDate = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10)
}
const isOverdue = (inv: Invoice) =>
  (inv.status === 'sent' || inv.status === 'overdue') && inv.due_date < today()

export function InvoicesPage() {
  const { addToast } = useToast()
  const { lang, t } = useLanguage()
  const navigate = useNavigate()

  const [data, setData] = useState<Page<Invoice> | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<LawyerProfile[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [filterClient, setFilterClient] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('standard')
  const [createClient, setCreateClient] = useState('')
  const [createProfile, setCreateProfile] = useState('')
  const [createCurrency, setCreateCurrency] = useState<Currency>('RUB')
  const [createVat, setCreateVat] = useState<VatType>('none')
  const [createPayCurrency, setCreatePayCurrency] = useState<Currency | ''>('')
  const [confirmedEntries, setConfirmedEntries] = useState<TimeEntry[]>([])
  const [clientProjects, setClientProjects] = useState<Project[]>([])
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set())
  const [advanceProject, setAdvanceProject] = useState('')
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [issueDate, setIssueDate] = useState(today())
  const [dueDate, setDueDate] = useState(futureDate(14))
  const [notes, setNotes] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [entriesLoading, setEntriesLoading] = useState(false)

  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const STATUS_OPTIONS = useMemo(() => [
    { value: 'draft', label: t.status.draft },
    { value: 'sent', label: t.status.sent },
    { value: 'paid', label: t.status.paid },
    { value: 'overdue', label: t.status.overdue },
  ], [t])

  const VAT_OPTIONS = useMemo(() => [
    { value: 'none' as const, label: t.vat.none },
    { value: 'exempt' as const, label: t.vat.exempt },
    { value: 'vat0' as const, label: t.vat.vat0 },
    { value: 'vat10' as const, label: t.vat.vat10 },
    { value: 'vat22' as const, label: t.vat.vat22 },
  ], [t])

  const handleDelete = async () => {
    if (!deleteInvoice) return
    setDeleteLoading(true)
    try {
      await invoicesService.delete(deleteInvoice.id)
      addToast('success', `${deleteInvoice.invoice_number} ${t.invoices.deletedToast}`)
      setDeleteInvoice(null)
      load()
    } catch {
      addToast('error', t.common.error)
    } finally {
      setDeleteLoading(false)
    }
  }

  useEffect(() => {
    clientsService.list({ size: 200 }).then(d => setClients(d.items)).catch(() => {})
    profileService.list().then(list => {
      setProfiles(list)
      profileService.getActive().then(p => {
        if (p) {
          setCreateProfile(String(p.id))
          setCreateCurrency(p.default_currency ?? 'RUB')
          setCreateVat(p.vat_type ?? 'none')
        }
      })
    }).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    invoicesService.list({
      client_id: filterClient ? Number(filterClient) : undefined,
      status: filterStatus as InvoiceStatus || undefined,
      date_from: filterDateFrom || undefined,
      date_to: filterDateTo || undefined,
      page, size: 20,
    })
      .then(setData)
      .catch(() => addToast('error', t.common.error))
      .finally(() => setLoading(false))
  }, [filterClient, filterStatus, filterDateFrom, filterDateTo, page, addToast, t])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!createProfile) return
    const p = profiles.find(pr => pr.id === Number(createProfile))
    if (p) { setCreateCurrency(p.default_currency ?? 'RUB'); setCreateVat(p.vat_type ?? 'none') }
  }, [createProfile, profiles])

  useEffect(() => {
    if (!createClient) {
      setConfirmedEntries([]); setClientProjects([]); setSelectedEntries(new Set()); return
    }
    setEntriesLoading(true)
    Promise.all([
      timeEntriesService.list({ client_id: Number(createClient), status: 'confirmed', size: 200 }),
      projectsService.list({ client_id: Number(createClient), size: 200 }),
    ])
      .then(([entries, projs]) => {
        setConfirmedEntries(entries.items); setClientProjects(projs.items); setSelectedEntries(new Set())
      })
      .catch(() => addToast('error', t.common.error))
      .finally(() => setEntriesLoading(false))
  }, [createClient, addToast, t])

  const projectMap = useMemo(() => {
    const m = new Map<number, Project>(); clientProjects.forEach(p => m.set(p.id, p)); return m
  }, [clientProjects])

  const toggleEntry = (id: number) => setSelectedEntries(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => selectedEntries.size === confirmedEntries.length
    ? setSelectedEntries(new Set())
    : setSelectedEntries(new Set(confirmedEntries.map(e => e.id)))

  const previewRows = useMemo(() => confirmedEntries.filter(e => selectedEntries.has(e.id)).map(e => {
    const proj = projectMap.get(e.project_id)
    const rate = parseFloat(proj?.hourly_rate ?? '0')
    const hours = parseFloat(e.duration_hours)
    return { id: e.id, date: e.date, projectName: proj?.name ?? `#${e.project_id}`, description: e.description ?? '', hours, rate, amount: hours * rate }
  }), [confirmedEntries, selectedEntries, projectMap])

  const previewSubtotal = previewRows.reduce((s, r) => s + r.amount, 0)
  const vatRate = createVat === 'vat22' ? 0.22 : createVat === 'vat10' ? 0.10 : 0
  const previewVat = previewSubtotal * vatRate
  const previewTotal = previewSubtotal + previewVat
  const sym = CURRENCY_SYMBOL[createCurrency]
  const allSelected = confirmedEntries.length > 0 && selectedEntries.size === confirmedEntries.length
  const locale = lang === 'en' ? 'en-US' : 'ru-RU'

  const resetCreateForm = () => {
    setCreateClient(''); setConfirmedEntries([]); setClientProjects([]); setSelectedEntries(new Set())
    setIssueDate(today()); setDueDate(futureDate(14)); setNotes(''); setCreatePayCurrency('')
    setInvoiceType('standard'); setAdvanceProject(''); setAdvanceAmount('')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createProfile) { addToast('error', t.invoices.selectProfileRequired); return }

    if (invoiceType === 'advance') {
      if (!createClient || !advanceProject || !advanceAmount) {
        addToast('error', t.invoices.selectClientEntry); return
      }
      setCreateLoading(true)
      const payload: InvoiceCreate = {
        invoice_type: 'advance',
        client_id: Number(createClient),
        profile_id: Number(createProfile),
        project_id: Number(advanceProject),
        advance_amount: advanceAmount,
        issue_date: issueDate, due_date: dueDate,
        notes: notes || null,
        currency: createCurrency, vat_type: createVat,
        payment_currency: createPayCurrency || undefined,
      }
      try {
        const inv = await invoicesService.create(payload)
        addToast('success', `${inv.invoice_number} ${t.invoices.createdToast}`)
        setShowCreate(false); resetCreateForm(); load()
      } catch (err: any) {
        addToast('error', err.message || t.common.error)
      } finally { setCreateLoading(false) }
      return
    }

    if (!createClient || selectedEntries.size === 0) { addToast('error', t.invoices.selectClientEntry); return }
    setCreateLoading(true)
    const payload: InvoiceCreate = {
      client_id: Number(createClient),
      profile_id: Number(createProfile),
      time_entry_ids: Array.from(selectedEntries),
      issue_date: issueDate, due_date: dueDate,
      notes: notes || null,
      currency: createCurrency, vat_type: createVat,
      payment_currency: createPayCurrency || undefined,
    }
    try {
      const inv = await invoicesService.create(payload)
      addToast('success', `${inv.invoice_number} ${t.invoices.createdToast}`)
      setShowCreate(false); resetCreateForm(); load()
    } catch (err: any) {
      addToast('error', err.message || t.common.error)
    } finally { setCreateLoading(false) }
  }

  const clientName = (id: number) => clients.find(c => c.id === id)?.name ?? `#${id}`
  const fmtAmount = (inv: Invoice) => {
    const s = CURRENCY_SYMBOL[inv.currency ?? 'RUB']
    return `${Number(inv.total_amount).toLocaleString(locale, { minimumFractionDigits: 2 })} ${s}`
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="filter-bar">
          <select className="form-input form-select filter-select" value={filterClient} onChange={e => { setFilterClient(e.target.value); setPage(1) }}>
            <option value="">{t.common.allClients}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="form-input form-select filter-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="">{t.common.allStatuses}</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="date" className="form-input filter-select" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(1) }} title={t.common.dateFrom} />
          <input type="date" className="form-input filter-select" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(1) }} title={t.common.dateTo} />
        </div>
        <Button onClick={() => setShowCreate(true)}>{t.invoices.createBtn}</Button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>{t.invoices.invoiceNumber}</th><th>{t.common.client}</th><th>{t.invoices.issueDate}</th><th>{t.invoices.dueDate}</th><th>{t.common.amount}</th><th>{t.common.status}</th><th></th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-empty"><span className="loading-text">{t.common.loading}</span></td></tr>
              ) : (data?.items ?? []).length === 0 ? (
                <tr><td colSpan={7} className="table-empty">{t.invoices.noInvoices}</td></tr>
              ) : (data?.items ?? []).map(inv => (
                <tr key={inv.id} className={isOverdue(inv) ? 'row-overdue' : undefined}>
                  <td className="invoice-num">{inv.invoice_number}</td>
                  <td>{clientName(inv.client_id)}</td>
                  <td>{inv.issue_date}</td>
                  <td>
                    <span className={isOverdue(inv) ? 'overdue-date' : undefined}>{inv.due_date}</span>
                    {isOverdue(inv) && <span className="overdue-tag">{t.invoices.overdueBadge}</span>}
                  </td>
                  <td className="td-num">{fmtAmount(inv)}</td>
                  <td>
                    {inv.invoice_type === 'advance' && (
                      <span className="badge badge-advance" style={{ marginRight: 4 }}>{t.invoices.advanceBadge}</span>
                    )}
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td>
                    <div className="table-actions">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/invoices/${inv.id}`)}>{t.invoices.openBtn}</Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteInvoice(inv)}>{t.common.delete}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={data?.pages ?? 0} total={data?.total ?? 0} onPageChange={setPage} />
      </div>

      <ConfirmModal
        isOpen={!!deleteInvoice}
        onClose={() => setDeleteInvoice(null)}
        onConfirm={handleDelete}
        title={t.invoices.deleteTitle}
        message={`${t.invoices.deleteTitle} ${deleteInvoice?.invoice_number}? ${t.invoices.deleteConfirm}`}
        loading={deleteLoading}
      />

      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetCreateForm() }} title={t.invoices.createModal} size="lg">
        <form onSubmit={handleCreate}>
          {/* Invoice type toggle */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">{t.invoices.invoiceType}</label>
            <div className="lang-switcher" style={{ padding: 0 }}>
              <button type="button"
                className={`lang-btn ${invoiceType === 'standard' ? 'lang-btn-active' : ''}`}
                onClick={() => setInvoiceType('standard')} style={{ fontSize: 13, padding: '4px 12px' }}>
                {t.invoices.standard}
              </button>
              <button type="button"
                className={`lang-btn ${invoiceType === 'advance' ? 'lang-btn-active' : ''}`}
                onClick={() => setInvoiceType('advance')} style={{ fontSize: 13, padding: '4px 12px' }}>
                {t.invoices.advanceLabel}
              </button>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">{t.invoices.profileLabel}</label>
              <select className="form-input form-select" value={createProfile} onChange={e => setCreateProfile(e.target.value)} required>
                <option value="">{t.invoices.selectProfile}</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{(p.default_currency === 'EUR' || p.default_currency === 'USD') ? 'EU' : '🇷🇺'} {p.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t.invoices.clientLabel}</label>
              <select className="form-input form-select" value={createClient} onChange={e => setCreateClient(e.target.value)} required>
                <option value="">{t.invoices.selectClient}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">{t.invoices.currencyLabel}</label>
              <select className="form-input form-select" value={createCurrency} onChange={e => setCreateCurrency(e.target.value as Currency)}>
                {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c} {CURRENCY_SYMBOL[c]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t.invoices.vatLabel}</label>
              <select className="form-input form-select" value={createVat} onChange={e => setCreateVat(e.target.value as VatType)}>
                {VAT_OPTIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t.invoices.payCurrencyLabel}</label>
              <select className="form-input form-select" value={createPayCurrency} onChange={e => setCreatePayCurrency(e.target.value as Currency | '')}>
                <option value="">{t.invoices.noConversion}</option>
                {CURRENCY_OPTIONS.filter(c => c !== createCurrency).map(c => <option key={c} value={c}>{c} {CURRENCY_SYMBOL[c]}</option>)}
              </select>
            </div>
          </div>

          {/* Advance-specific fields */}
          {invoiceType === 'advance' && (
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t.invoices.advanceProjectLabel}</label>
                {!createClient ? (
                  <p className="create-no-entries">{t.invoices.advanceSelectClient}</p>
                ) : entriesLoading ? (
                  <p className="loading-text" style={{ padding: '8px 0' }}>{t.common.loading}</p>
                ) : clientProjects.length === 0 ? (
                  <p className="create-no-entries">{t.invoices.noProjectsForClient}</p>
                ) : (
                  <select className="form-input form-select" value={advanceProject}
                    onChange={e => setAdvanceProject(e.target.value)} required>
                    <option value="">{t.invoices.selectProject}</option>
                    {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">{t.invoices.advanceAmountLabel}</label>
                <input
                  type="number" min="0.01" step="0.01"
                  className="form-input"
                  value={advanceAmount}
                  onChange={e => setAdvanceAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          )}

          {/* Standard: time entries */}
          {invoiceType === 'standard' && createClient && (
            <div className="form-group">
              <div className="create-entries-header">
                <label className="form-label" style={{ margin: 0 }}>{t.invoices.confirmedEntriesLabel}</label>
                {confirmedEntries.length > 0 && (
                  <label className="check-all-label">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                    {t.invoices.selectAll}
                  </label>
                )}
              </div>
              {entriesLoading ? (
                <p className="loading-text" style={{ padding: '12px 0' }}>{t.common.loading}</p>
              ) : confirmedEntries.length === 0 ? (
                <p className="create-no-entries">{t.invoices.noConfirmedEntries}</p>
              ) : (
                <div className="entry-checklist">
                  {confirmedEntries.map(entry => {
                    const proj = projectMap.get(entry.project_id)
                    const rate = parseFloat(proj?.hourly_rate ?? '0')
                    const amount = parseFloat(entry.duration_hours) * rate
                    return (
                      <label key={entry.id} className={`entry-check-item${selectedEntries.has(entry.id) ? ' entry-check-selected' : ''}`}>
                        <input type="checkbox" checked={selectedEntries.has(entry.id)} onChange={() => toggleEntry(entry.id)} />
                        <span className="entry-check-date">{entry.date}</span>
                        <span className="entry-check-project">{proj?.name ?? `#${entry.project_id}`}</span>
                        {entry.description && <span className="entry-check-desc">{entry.description}</span>}
                        <span className="entry-check-hours">{entry.duration_hours} {t.invoices.hours}</span>
                        {rate > 0 && <span className="entry-check-amount">{amount.toLocaleString(locale, { maximumFractionDigits: 0 })} {sym}</span>}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {invoiceType === 'standard' && previewRows.length > 0 && (
            <div className="form-group">
              <label className="form-label">{t.invoices.previewLabel}</label>
              <div className="invoice-preview">
                <table className="table">
                  <thead>
                    <tr><th>{t.invoices.date}</th><th>{t.invoices.project}</th><th>{t.invoices.description}</th><th>{t.invoices.hoursCol}</th><th>{t.invoices.rateCol}</th><th>{t.invoices.amountCol}</th></tr>
                  </thead>
                  <tbody>
                    {previewRows.map(r => (
                      <tr key={r.id}>
                        <td>{r.date}</td><td>{r.projectName}</td>
                        <td className="td-desc">{r.description || '—'}</td>
                        <td className="td-num">{r.hours.toFixed(1)}</td>
                        <td className="td-num">{r.rate > 0 ? `${r.rate.toLocaleString(locale)} ${sym}` : '—'}</td>
                        <td className="td-num">{r.rate > 0 ? `${r.amount.toLocaleString(locale, { minimumFractionDigits: 2 })} ${sym}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="table-total-row">
                      <td colSpan={3} className="total-label">{t.invoices.subtotalNoVat}</td>
                      <td className="td-num total-value">{previewRows.reduce((s, r) => s + r.hours, 0).toFixed(1)} {t.invoices.hours}</td>
                      <td /><td className="td-num total-value">{previewSubtotal > 0 ? `${previewSubtotal.toLocaleString(locale, { minimumFractionDigits: 2 })} ${sym}` : '—'}</td>
                    </tr>
                    {vatRate > 0 && (
                      <tr className="table-total-row">
                        <td colSpan={5} className="total-label">{t.vat[createVat]}:</td>
                        <td className="td-num total-value">{previewVat.toLocaleString(locale, { minimumFractionDigits: 2 })} {sym}</td>
                      </tr>
                    )}
                    <tr className="table-total-row">
                      <td colSpan={5} className="total-label"><strong>{t.invoices.totalRow}</strong></td>
                      <td className="td-num total-value"><strong>{previewTotal > 0 ? `${previewTotal.toLocaleString(locale, { minimumFractionDigits: 2 })} ${sym}` : '—'}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">{t.invoices.issueDateLabel}</label>
              <input type="date" className="form-input" value={issueDate} onChange={e => setIssueDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t.invoices.dueDateLabel}</label>
              <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t.invoices.notesLabel}</label>
            <textarea className="form-input form-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t.invoices.notesPlaceholder} />
          </div>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => { setShowCreate(false); resetCreateForm() }}>{t.common.cancel}</Button>
            <Button type="submit" loading={createLoading}
              disabled={invoiceType === 'standard' ? selectedEntries.size === 0 : !advanceProject || !advanceAmount}>
              {t.invoices.createInvoiceBtn}
              {invoiceType === 'standard' && selectedEntries.size > 0 && ` (${selectedEntries.size})`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
