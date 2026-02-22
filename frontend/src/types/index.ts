export interface Column<T> {
  key: string
  label: string
  render?: (row: T) => import('react').ReactNode
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export type ProjectStatus = 'active' | 'paused' | 'completed'
export type TimeEntryStatus = 'draft' | 'confirmed' | 'billed'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export interface Client {
  id: number
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  inn: string | null
  bank_name: string | null
  bik: string | null
  checking_account: string | null
  correspondent_account: string | null
  notes: string | null
  created_at: string
}

export interface ClientCreate {
  name: string
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  inn?: string | null
  bank_name?: string | null
  bik?: string | null
  checking_account?: string | null
  correspondent_account?: string | null
  notes?: string | null
}

export type ClientUpdate = Partial<ClientCreate>

export interface Project {
  id: number
  client_id: number
  name: string
  description: string | null
  hourly_rate: string | null
  currency: string
  status: ProjectStatus
  created_at: string
}

export interface ProjectStats {
  total_hours: string
  confirmed_hours: string
  unbilled_hours: string
}

export interface ProjectDetail extends Project {
  stats: ProjectStats
}

export interface ProjectCreate {
  client_id: number
  name: string
  description?: string | null
  hourly_rate?: string | null
  currency?: string
  status?: ProjectStatus
}

export type ProjectUpdate = Partial<Omit<ProjectCreate, 'client_id'>>

export interface TimeEntry {
  id: number
  project_id: number
  date: string
  duration_hours: string
  description: string | null
  status: TimeEntryStatus
  created_at: string
  updated_at: string
}

export interface TimeEntryCreate {
  project_id: number
  date: string
  duration_hours: number | string
  description?: string | null
}

export interface TimeEntryUpdate {
  date?: string
  duration_hours?: number | string
  description?: string | null
}

export interface InvoiceItem {
  id: number
  time_entry_id: number | null
  hours: string
  rate: string
  amount: string
  // enriched from linked time entry
  date: string | null
  project_name: string | null
  description: string | null
}

export interface Invoice {
  id: number
  client_id: number
  invoice_number: string
  issue_date: string
  due_date: string
  status: InvoiceStatus
  notes: string | null
  created_at: string
  items: InvoiceItem[]
  total_amount: string
}

export interface InvoiceCreate {
  client_id: number
  time_entry_ids: number[]
  issue_date: string
  due_date: string
  notes?: string | null
}

export interface InvoiceUpdate {
  issue_date?: string
  due_date?: string
  notes?: string | null
}

export interface LawyerProfile {
  id: number
  full_name: string
  company_name: string
  inn: string
  address: string
  bank_name: string
  bik: string
  checking_account: string
  correspondent_account: string
  email: string
  phone: string
  default_hourly_rate: string
  logo_path: string | null
}

export interface LawyerProfileUpdate {
  full_name?: string | null
  company_name?: string | null
  inn?: string | null
  address?: string | null
  bank_name?: string | null
  bik?: string | null
  checking_account?: string | null
  correspondent_account?: string | null
  email?: string | null
  phone?: string | null
  default_hourly_rate?: string | null
  logo_path?: string | null
}

export interface BulkConfirmResponse {
  confirmed_count: number
  skipped_count: number
  skipped_ids: number[]
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export interface DashboardRecentEntry {
  id: number
  date: string
  project_id: number
  project_name: string
  client_id: number
  client_name: string
  duration_hours: number
  description: string | null
  status: TimeEntryStatus
}

export interface DashboardRecentInvoice {
  id: number
  invoice_number: string
  client_id: number
  client_name: string
  issue_date: string
  due_date: string
  status: InvoiceStatus
  total_amount: number
}

export interface DashboardData {
  hours_this_week: number
  hours_this_month: number
  unbilled_amount: number
  unpaid_amount: number
  overdue_invoices_count: number
  recent_time_entries: DashboardRecentEntry[]
  recent_invoices: DashboardRecentInvoice[]
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface ProjectBreakdown {
  project_id: number
  project_name: string
  entries_count: number
  hours: number
  amount: number
}

export interface ClientBreakdown {
  client_id: number
  client_name: string
  hours: number
  amount: number
  projects: ProjectBreakdown[]
}

export interface InvoiceSummary {
  count_total: number
  count_paid: number
  count_unpaid: number
  count_overdue: number
  total_invoiced: number
  total_paid: number
  total_unpaid: number
}

export interface ReportData {
  date_from: string
  date_to: string
  client_id: number | null
  total_hours: number
  total_amount: number
  breakdown: ClientBreakdown[]
  invoice_summary: InvoiceSummary
}
