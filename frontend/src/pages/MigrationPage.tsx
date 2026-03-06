import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface MigrationResult {
  table: string
  count: number
  error?: string
}

function loadLS<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(`billing_${key}`) ?? '[]') as T[]
  } catch {
    return []
  }
}

export function MigrationPage() {
  const [results, setResults] = useState<MigrationResult[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  const preview = () => {
    const keys = ['clients', 'profiles', 'projects', 'time_entries', 'invoices']
    return keys.map(k => ({ key: k, count: loadLS(k).length }))
  }

  const migrate = async () => {
    setRunning(true)
    setResults([])
    const log: MigrationResult[] = []

    // 1. clients
    const clients = loadLS<Record<string, unknown>>('clients')
    if (clients.length > 0) {
      const rows = clients.map(c => ({
        name: c.name,
        contact_person: c.contact_person ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        address: c.address ?? null,
        inn: c.inn ?? null,
        bank_name: c.bank_name ?? null,
        bik: c.bik ?? null,
        checking_account: c.checking_account ?? null,
        correspondent_account: c.correspondent_account ?? null,
        notes: c.notes ?? null,
        created_at: c.created_at as string,
      }))
      const { error } = await supabase.from('clients').insert(rows)
      log.push({ table: 'clients', count: rows.length, error: error?.message })
    } else {
      log.push({ table: 'clients', count: 0 })
    }
    setResults([...log])

    // 2. lawyer_profiles (key: 'profiles')
    const profiles = loadLS<Record<string, unknown>>('profiles')
    if (profiles.length > 0) {
      const rows = profiles.map(p => ({
        label: p.label ?? 'Профиль',
        type: p.type ?? 'ru',
        language: p.language ?? 'ru',
        full_name: p.full_name ?? '',
        company_name: p.company_name ?? '',
        address: p.address ?? '',
        email: p.email ?? '',
        phone: p.phone ?? '',
        default_hourly_rate: p.default_hourly_rate ?? '',
        default_currency: p.default_currency ?? 'RUB',
        vat_type: p.vat_type ?? 'none',
        logo_path: p.logo_path ?? null,
        inn: p.inn ?? null,
        bank_name: p.bank_name ?? null,
        bik: p.bik ?? null,
        checking_account: p.checking_account ?? null,
        correspondent_account: p.correspondent_account ?? null,
        iban: p.iban ?? null,
        swift: p.swift ?? null,
        bank_country: p.bank_country ?? null,
        vat_number: p.vat_number ?? null,
      }))
      const { error } = await supabase.from('lawyer_profiles').insert(rows)
      log.push({ table: 'lawyer_profiles', count: rows.length, error: error?.message })
    } else {
      log.push({ table: 'lawyer_profiles', count: 0 })
    }
    setResults([...log])

    // 3. Fetch inserted clients and profiles to map old IDs → new IDs
    const { data: newClients } = await supabase.from('clients').select('id, name, created_at').order('created_at')
    const { data: newProfiles } = await supabase.from('lawyer_profiles').select('id, label').order('id')

    const oldClients = loadLS<Record<string, unknown>>('clients')
    const clientIdMap = new Map<number, number>()
    oldClients.forEach((oc, i) => {
      const nc = newClients?.[i]
      if (nc) clientIdMap.set(oc.id as number, nc.id)
    })

    const oldProfiles = loadLS<Record<string, unknown>>('profiles')
    const profileIdMap = new Map<number, number>()
    oldProfiles.forEach((op, i) => {
      const np = newProfiles?.[i]
      if (np) profileIdMap.set(op.id as number, np.id)
    })

    // 4. projects
    const projects = loadLS<Record<string, unknown>>('projects')
    const projectIdMap = new Map<number, number>()
    if (projects.length > 0) {
      const rows = projects.map(p => ({
        client_id: clientIdMap.get(p.client_id as number) ?? null,
        name: p.name,
        description: p.description ?? null,
        hourly_rate: p.hourly_rate ?? null,
        currency: p.currency ?? 'RUB',
        status: p.status ?? 'active',
        created_at: p.created_at as string,
      }))
      const { data: inserted, error } = await supabase.from('projects').insert(rows).select('id')
      log.push({ table: 'projects', count: rows.length, error: error?.message })
      projects.forEach((p, i) => {
        const ni = inserted?.[i]
        if (ni) projectIdMap.set(p.id as number, ni.id)
      })
    } else {
      log.push({ table: 'projects', count: 0 })
    }
    setResults([...log])

    // 5. time_entries
    const entries = loadLS<Record<string, unknown>>('time_entries')
    const entryIdMap = new Map<number, number>()
    if (entries.length > 0) {
      const rows = entries.map(e => ({
        project_id: projectIdMap.get(e.project_id as number) ?? null,
        date: e.date,
        duration_hours: String(e.duration_hours),
        description: e.description ?? null,
        status: e.status ?? 'draft',
        created_at: e.created_at as string,
        updated_at: e.updated_at as string,
      }))
      const { data: inserted, error } = await supabase.from('time_entries').insert(rows).select('id')
      log.push({ table: 'time_entries', count: rows.length, error: error?.message })
      entries.forEach((e, i) => {
        const ni = inserted?.[i]
        if (ni) entryIdMap.set(e.id as number, ni.id)
      })
    } else {
      log.push({ table: 'time_entries', count: 0 })
    }
    setResults([...log])

    // 6. invoices + invoice_items
    const invoices = loadLS<Record<string, unknown>>('invoices')
    if (invoices.length > 0) {
      let invoiceCount = 0
      let itemCount = 0
      let invoiceError: string | undefined
      for (const inv of invoices) {
        const invoiceRow = {
          client_id: clientIdMap.get(inv.client_id as number) ?? null,
          profile_id: profileIdMap.get(inv.profile_id as number) ?? (newProfiles?.[0]?.id ?? null),
          invoice_number: inv.invoice_number,
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          status: inv.status ?? 'draft',
          notes: inv.notes ?? null,
          currency: inv.currency ?? 'RUB',
          vat_type: inv.vat_type === 'vat20' ? 'vat22' : (inv.vat_type ?? 'none'),
          subtotal: inv.subtotal ?? '0',
          vat_amount: inv.vat_amount ?? '0',
          total_amount: inv.total_amount ?? '0',
          payment_currency: inv.payment_currency ?? null,
          exchange_rate: inv.exchange_rate ?? null,
          payment_amount: inv.payment_amount ?? null,
          created_at: inv.created_at as string,
        }
        const { data: createdInvoice, error: ie } = await supabase.from('invoices').insert(invoiceRow).select('id').single()
        if (ie) { invoiceError = ie.message; break }
        invoiceCount++

        const items = (inv.items as Record<string, unknown>[]) ?? []
        if (items.length > 0) {
          const itemRows = items.map(item => ({
            invoice_id: createdInvoice.id,
            time_entry_id: entryIdMap.get(item.time_entry_id as number) ?? null,
            hours: String(item.hours),
            rate: String(item.rate),
            amount: String(item.amount),
            date: item.date ?? null,
            project_name: item.project_name ?? null,
            description: item.description ?? null,
          }))
          const { error: ite } = await supabase.from('invoice_items').insert(itemRows)
          if (ite) { invoiceError = ite.message; break }
          itemCount += itemRows.length
        }
      }
      log.push({ table: 'invoices', count: invoiceCount, error: invoiceError })
      log.push({ table: 'invoice_items', count: itemCount })
    } else {
      log.push({ table: 'invoices', count: 0 })
    }
    setResults([...log])

    setRunning(false)
    setDone(true)
  }

  const previewData = preview()
  const hasData = previewData.some(p => p.count > 0)

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 16px' }}>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Перенос данных из браузера в Supabase</h2>
        </div>
        <div style={{ padding: '20px 0' }}>
          <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
            Найдено данных в localStorage этого браузера:
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <tbody>
              {previewData.map(({ key, count }) => (
                <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 0', fontSize: 14, color: 'var(--text)' }}>{key}</td>
                  <td style={{ padding: '8px 0', fontSize: 14, textAlign: 'right', fontWeight: 600 }}>
                    {count} записей
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!hasData && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
              Данных для переноса не найдено. Возможно, вы открыли приложение в другом браузере.
            </p>
          )}

          {results.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Результат:</p>
              {results.map(r => (
                <div key={r.table} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <span>{r.table}</span>
                  <span style={{ color: r.error ? 'var(--danger)' : 'var(--success)' }}>
                    {r.error ? `Ошибка: ${r.error}` : `✓ ${r.count} записей`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {done && !results.some(r => r.error) && (
            <p style={{ color: 'var(--success)', fontWeight: 600, marginBottom: 20, fontSize: 14 }}>
              Перенос завершён успешно! Можете удалить данные из localStorage.
            </p>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-primary btn-md"
              onClick={migrate}
              disabled={running || done || !hasData}
            >
              {running ? 'Переносим...' : done ? 'Готово' : 'Перенести данные'}
            </button>
            {done && (
              <button
                className="btn btn-secondary btn-md"
                onClick={() => {
                  const keys = ['clients', 'profiles', 'projects', 'time_entries', 'invoices']
                  keys.forEach(k => localStorage.removeItem(`billing_${k}`))
                  alert('localStorage очищен')
                }}
              >
                Очистить localStorage
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
