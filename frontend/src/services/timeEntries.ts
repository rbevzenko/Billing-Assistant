import { load, save, nextId, nowISO, paginate } from './storage'
import type { BulkConfirmResponse, Page, Project, TimeEntry, TimeEntryCreate, TimeEntryStatus, TimeEntryUpdate } from '@/types'

const KEY = 'time_entries'

export const timeEntriesService = {
  list: (params: {
    client_id?: number
    project_id?: number
    date_from?: string
    date_to?: string
    status?: TimeEntryStatus
    page?: number
    size?: number
  }): Promise<Page<TimeEntry>> => {
    let items = load<TimeEntry>(KEY)
    if (params.project_id) items = items.filter(e => e.project_id === params.project_id)
    if (params.status) items = items.filter(e => e.status === params.status)
    if (params.date_from) items = items.filter(e => e.date >= params.date_from!)
    if (params.date_to) items = items.filter(e => e.date <= params.date_to!)
    if (params.client_id) {
      const projectIds = new Set(
        load<Project>('projects')
          .filter(p => p.client_id === params.client_id)
          .map(p => p.id)
      )
      items = items.filter(e => projectIds.has(e.project_id))
    }
    items = [...items].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    return Promise.resolve(paginate(items, params.page ?? 1, params.size ?? 20))
  },

  create: (data: TimeEntryCreate): Promise<TimeEntry> => {
    const items = load<TimeEntry>(KEY)
    const entry: TimeEntry = {
      id: nextId(items),
      project_id: data.project_id,
      date: data.date,
      duration_hours: String(data.duration_hours),
      description: data.description ?? null,
      status: 'draft',
      created_at: nowISO(),
      updated_at: nowISO(),
    }
    save(KEY, [...items, entry])
    return Promise.resolve(entry)
  },

  update: (id: number, data: TimeEntryUpdate): Promise<TimeEntry> => {
    const items = load<TimeEntry>(KEY)
    const idx = items.findIndex(e => e.id === id)
    if (idx === -1) return Promise.reject(new Error('Запись не найдена'))
    const updated: TimeEntry = {
      ...items[idx],
      ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
      updated_at: nowISO(),
    }
    items[idx] = updated
    save(KEY, items)
    return Promise.resolve(updated)
  },

  delete: (id: number): Promise<void> => {
    save(KEY, load<TimeEntry>(KEY).filter(e => e.id !== id))
    return Promise.resolve()
  },

  confirm: (id: number): Promise<TimeEntry> => {
    const items = load<TimeEntry>(KEY)
    const idx = items.findIndex(e => e.id === id)
    if (idx === -1) return Promise.reject(new Error('Запись не найдена'))
    items[idx] = { ...items[idx], status: 'confirmed', updated_at: nowISO() }
    save(KEY, items)
    return Promise.resolve(items[idx])
  },

  bulkConfirm: (ids: number[]): Promise<BulkConfirmResponse> => {
    const items = load<TimeEntry>(KEY)
    let confirmed_count = 0
    const skipped_ids: number[] = []
    for (const id of ids) {
      const idx = items.findIndex(e => e.id === id)
      if (idx !== -1 && items[idx].status === 'draft') {
        items[idx] = { ...items[idx], status: 'confirmed', updated_at: nowISO() }
        confirmed_count++
      } else {
        skipped_ids.push(id)
      }
    }
    save(KEY, items)
    return Promise.resolve({ confirmed_count, skipped_count: skipped_ids.length, skipped_ids })
  },
}
