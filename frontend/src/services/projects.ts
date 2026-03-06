import { supabase } from '@/lib/supabase'
import type { Page, Project, ProjectCreate, ProjectDetail, ProjectUpdate, ProjectStatus } from '@/types'

const TABLE = 'projects'

function paginate<T>(items: T[], total: number, page: number, size: number): Page<T> {
  return { items, total, page, size, pages: Math.ceil(total / size) || 1 }
}

export const projectsService = {
  list: async (params: { client_id?: number; status?: ProjectStatus; page?: number; size?: number }): Promise<Page<Project>> => {
    const page = params.page ?? 1
    const size = params.size ?? 20
    const from = (page - 1) * size
    const to = from + size - 1

    let query = supabase.from(TABLE).select('*', { count: 'exact' })
    if (params.client_id) query = query.eq('client_id', params.client_id)
    if (params.status) query = query.eq('status', params.status)
    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, error, count } = await query
    if (error) throw error
    return paginate(data as Project[], count ?? 0, page, size)
  },

  get: async (id: number): Promise<ProjectDetail> => {
    const { data: project, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
    if (error) throw new Error('Проект не найден')

    const { data: entries } = await supabase
      .from('time_entries')
      .select('duration_hours, status')
      .eq('project_id', id)

    const all = entries ?? []
    const total_hours = all.reduce((s, e) => s + parseFloat(e.duration_hours), 0)
    const confirmed_hours = all.filter(e => e.status !== 'draft').reduce((s, e) => s + parseFloat(e.duration_hours), 0)
    const unbilled_hours = all.filter(e => e.status === 'confirmed').reduce((s, e) => s + parseFloat(e.duration_hours), 0)

    return {
      ...(project as Project),
      stats: {
        total_hours: total_hours.toFixed(2),
        confirmed_hours: confirmed_hours.toFixed(2),
        unbilled_hours: unbilled_hours.toFixed(2),
      },
    }
  },

  create: async (data: ProjectCreate): Promise<Project> => {
    const { data: created, error } = await supabase.from(TABLE).insert({
      client_id: data.client_id,
      name: data.name,
      description: data.description ?? null,
      hourly_rate: data.hourly_rate ?? null,
      currency: data.currency ?? 'RUB',
      status: data.status ?? 'active',
    }).select().single()
    if (error) throw error
    return created as Project
  },

  update: async (id: number, data: ProjectUpdate): Promise<Project> => {
    const { data: updated, error } = await supabase.from(TABLE).update(data).eq('id', id).select().single()
    if (error) throw new Error('Проект не найден')
    return updated as Project
  },

  delete: async (id: number): Promise<void> => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
  },
}
