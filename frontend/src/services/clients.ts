import { supabase } from '@/lib/supabase'
import type { Client, ClientCreate, ClientUpdate, Page } from '@/types'

const TABLE = 'clients'

function paginate<T>(items: T[], total: number, page: number, size: number): Page<T> {
  return { items, total, page, size, pages: Math.ceil(total / size) || 1 }
}

export const clientsService = {
  list: async (params: { search?: string; page?: number; size?: number }): Promise<Page<Client>> => {
    const page = params.page ?? 1
    const size = params.size ?? 20
    const from = (page - 1) * size
    const to = from + size - 1

    let query = supabase.from(TABLE).select('*', { count: 'exact' })
    if (params.search) {
      query = query.or(
        `name.ilike.%${params.search}%,contact_person.ilike.%${params.search}%,email.ilike.%${params.search}%`
      )
    }
    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, error, count } = await query
    if (error) throw error
    return paginate(data as Client[], count ?? 0, page, size)
  },

  get: async (id: number): Promise<Client> => {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
    if (error) throw new Error('Клиент не найден')
    return data as Client
  },

  create: async (data: ClientCreate): Promise<Client> => {
    const { data: created, error } = await supabase.from(TABLE).insert(data).select().single()
    if (error) throw error
    return created as Client
  },

  update: async (id: number, data: ClientUpdate): Promise<Client> => {
    const { data: updated, error } = await supabase.from(TABLE).update(data).eq('id', id).select().single()
    if (error) throw new Error('Клиент не найден')
    return updated as Client
  },

  delete: async (id: number): Promise<void> => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
  },
}
