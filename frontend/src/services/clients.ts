import { load, save, nextId, nowISO, paginate } from './storage'
import type { Client, ClientCreate, ClientUpdate, Page } from '@/types'

const KEY = 'clients'

export const clientsService = {
  list: (params: { search?: string; page?: number; size?: number }): Promise<Page<Client>> => {
    let items = load<Client>(KEY)
    if (params.search) {
      const q = params.search.toLowerCase()
      items = items.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.contact_person?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false)
      )
    }
    return Promise.resolve(paginate(items, params.page ?? 1, params.size ?? 20))
  },

  get: (id: number): Promise<Client> => {
    const item = load<Client>(KEY).find(c => c.id === id)
    if (!item) return Promise.reject(new Error('Клиент не найден'))
    return Promise.resolve(item)
  },

  create: (data: ClientCreate): Promise<Client> => {
    const items = load<Client>(KEY)
    const client: Client = {
      id: nextId(items),
      name: data.name,
      contact_person: data.contact_person ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      inn: data.inn ?? null,
      bank_name: data.bank_name ?? null,
      bik: data.bik ?? null,
      checking_account: data.checking_account ?? null,
      correspondent_account: data.correspondent_account ?? null,
      notes: data.notes ?? null,
      created_at: nowISO(),
    }
    save(KEY, [...items, client])
    return Promise.resolve(client)
  },

  update: (id: number, data: ClientUpdate): Promise<Client> => {
    const items = load<Client>(KEY)
    const idx = items.findIndex(c => c.id === id)
    if (idx === -1) return Promise.reject(new Error('Клиент не найден'))
    const updated: Client = { ...items[idx], ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) }
    items[idx] = updated
    save(KEY, items)
    return Promise.resolve(updated)
  },

  delete: (id: number): Promise<void> => {
    save(KEY, load<Client>(KEY).filter(c => c.id !== id))
    return Promise.resolve()
  },
}
