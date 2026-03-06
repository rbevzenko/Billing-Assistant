import { supabase } from '@/lib/supabase'
import type {
  Currency, DashboardData, DashboardRecentEntry, DashboardRecentInvoice,
} from '@/types'

function weekBounds(): { from: string; to: string } {
  const now = new Date()
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1 // Mon=0
  const from = new Date(now)
  from.setDate(now.getDate() - day)
  const to = new Date(from)
  to.setDate(from.getDate() + 6)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

function monthBounds(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

export const dashboardService = {
  get: async (): Promise<DashboardData> => {
    const week = weekBounds()
    const month = monthBounds()
    const today = new Date().toISOString().slice(0, 10)

    const [
      { data: entries },
      { data: invoices },
      { data: projects },
      { data: clients },
      { data: profiles },
    ] = await Promise.all([
      supabase.from('time_entries').select('*'),
      supabase.from('invoices').select('*'),
      supabase.from('projects').select('*'),
      supabase.from('clients').select('id, name'),
      supabase.from('lawyer_profiles').select('*').order('id'),
    ])

    const activeId = localStorage.getItem('billing_active_profile_id')
    const allProfiles = profiles ?? []
    const profile = (activeId ? allProfiles.find(p => p.id === Number(activeId)) : null) ?? allProfiles[0] ?? null

    const allEntries = entries ?? []
    const allInvoices = invoices ?? []
    const allProjects = projects ?? []
    const allClients = clients ?? []

    const hours_this_week = allEntries
      .filter(e => e.date >= week.from && e.date <= week.to)
      .reduce((s, e) => s + parseFloat(e.duration_hours), 0)

    const hours_this_month = allEntries
      .filter(e => e.date >= month.from && e.date <= month.to)
      .reduce((s, e) => s + parseFloat(e.duration_hours), 0)

    const unbilled_by_currency: Partial<Record<Currency, number>> = {}
    const unbilled_amount = allEntries
      .filter(e => e.status === 'confirmed')
      .reduce((s, e) => {
        const project = allProjects.find(p => p.id === e.project_id)
        const rate = parseFloat(project?.hourly_rate ?? profile?.default_hourly_rate ?? '0')
        const cur = (project?.currency ?? 'RUB') as Currency
        const amt = parseFloat(e.duration_hours) * rate
        unbilled_by_currency[cur] = (unbilled_by_currency[cur] ?? 0) + amt
        return s + amt
      }, 0)

    const unpaid_amount = allInvoices
      .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
      .reduce((s, inv) => s + parseFloat(inv.total_amount), 0)

    const overdue_invoices_count = allInvoices.filter(
      inv => inv.due_date < today && inv.status !== 'paid'
    ).length

    const recent_time_entries: DashboardRecentEntry[] = [...allEntries]
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map(e => {
        const project = allProjects.find(p => p.id === e.project_id)
        const client = allClients.find(c => c.id === project?.client_id)
        return {
          id: e.id,
          date: e.date,
          project_id: e.project_id,
          project_name: project?.name ?? '—',
          client_id: project?.client_id ?? 0,
          client_name: client?.name ?? '—',
          duration_hours: parseFloat(e.duration_hours),
          description: e.description,
          status: e.status,
        }
      })

    const recent_invoices: DashboardRecentInvoice[] = [...allInvoices]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map(inv => {
        const client = allClients.find(c => c.id === inv.client_id)
        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          client_id: inv.client_id,
          client_name: client?.name ?? '—',
          issue_date: inv.issue_date,
          currency: inv.currency ?? 'RUB',
          due_date: inv.due_date,
          status: inv.status,
          total_amount: parseFloat(inv.total_amount),
        }
      })

    return {
      hours_this_week,
      hours_this_month,
      unbilled_amount,
      unbilled_by_currency,
      unpaid_amount,
      overdue_invoices_count,
      recent_time_entries,
      recent_invoices,
    }
  },
}
