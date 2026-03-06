import { supabase } from '@/lib/supabase'
import type { BulkConfirmResponse, Page, TimeEntry, TimeEntryCreate, TimeEntryStatus, TimeEntryUpdate } from '@/types'

const TABLE = 'time_entries'

function paginate<T>(items: T[], total: number, page: number, size: number): Page<T> {
  return { items, total, page, size, pages: Math.ceil(total / size) || 1 }
}

export const timeEntriesService = {
  list: async (params: {
    client_id?: number
    project_id?: number
    date_from?: string
    date_to?: string
    status?: TimeEntryStatus
    page?: number
    size?: number
  }): Promise<Page<TimeEntry>> => {
    const page = params.page ?? 1
    const size = params.size ?? 20
    const from = (page - 1) * size
    const to = from + size - 1

    let projectIds: number[] | null = null
    if (params.client_id) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('client_id', params.client_id)
      projectIds = (projects ?? []).map(p => p.id)
      if (projectIds.length === 0) return paginate([], 0, page, size)
    }

    let query = supabase.from(TABLE).select('*', { count: 'exact' })
    if (params.project_id) query = query.eq('project_id', params.project_id)
    else if (projectIds) query = query.in('project_id', projectIds)
    if (params.status) query = query.eq('status', params.status)
    if (params.date_from) query = query.gte('date', params.date_from)
    if (params.date_to) query = query.lte('date', params.date_to)
    query = query.order('date', { ascending: false }).order('created_at', { ascending: false }).range(from, to)

    const { data, error, count } = await query
    if (error) throw error
    return paginate(data as TimeEntry[], count ?? 0, page, size)
  },

  create: async (data: TimeEntryCreate): Promise<TimeEntry> => {
    const { data: created, error } = await supabase.from(TABLE).insert({
      project_id: data.project_id,
      date: data.date,
      duration_hours: String(data.duration_hours),
      description: data.description ?? null,
      status: 'draft',
    }).select().single()
    if (error) throw error
    return created as TimeEntry
  },

  update: async (id: number, data: TimeEntryUpdate): Promise<TimeEntry> => {
    const { data: updated, error } = await supabase
      .from(TABLE)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error('Запись не найдена')
    return updated as TimeEntry
  },

  delete: async (id: number): Promise<void> => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
  },

  confirm: async (id: number): Promise<TimeEntry> => {
    const { data: updated, error } = await supabase
      .from(TABLE)
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error('Запись не найдена')
    return updated as TimeEntry
  },

  bulkConfirm: async (ids: number[]): Promise<BulkConfirmResponse> => {
    const { data: drafts, error } = await supabase
      .from(TABLE)
      .select('id')
      .in('id', ids)
      .eq('status', 'draft')
    if (error) throw error

    const draftIds = (drafts ?? []).map(e => e.id)
    const skipped_ids = ids.filter(id => !draftIds.includes(id))

    if (draftIds.length > 0) {
      await supabase
        .from(TABLE)
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .in('id', draftIds)
    }

    return { confirmed_count: draftIds.length, skipped_count: skipped_ids.length, skipped_ids }
  },
}
