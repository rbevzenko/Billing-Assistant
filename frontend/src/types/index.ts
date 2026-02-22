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
