import { load, save, nextId, nowISO, paginate } from './storage'
import type { Page, Project, ProjectCreate, ProjectDetail, ProjectUpdate, ProjectStatus, TimeEntry } from '@/types'

const KEY = 'projects'
const TE_KEY = 'time_entries'

export const projectsService = {
  list: (params: { client_id?: number; status?: ProjectStatus; page?: number; size?: number }): Promise<Page<Project>> => {
    let items = load<Project>(KEY)
    if (params.client_id) items = items.filter(p => p.client_id === params.client_id)
    if (params.status) items = items.filter(p => p.status === params.status)
    return Promise.resolve(paginate(items, params.page ?? 1, params.size ?? 20))
  },

  get: (id: number): Promise<ProjectDetail> => {
    const project = load<Project>(KEY).find(p => p.id === id)
    if (!project) return Promise.reject(new Error('Проект не найден'))
    const entries = load<TimeEntry>(TE_KEY).filter(e => e.project_id === id)
    const total_hours = entries.reduce((s, e) => s + parseFloat(e.duration_hours), 0)
    const confirmed_hours = entries
      .filter(e => e.status !== 'draft')
      .reduce((s, e) => s + parseFloat(e.duration_hours), 0)
    const unbilled_hours = entries
      .filter(e => e.status === 'confirmed')
      .reduce((s, e) => s + parseFloat(e.duration_hours), 0)
    return Promise.resolve({
      ...project,
      stats: {
        total_hours: total_hours.toFixed(2),
        confirmed_hours: confirmed_hours.toFixed(2),
        unbilled_hours: unbilled_hours.toFixed(2),
      },
    })
  },

  create: (data: ProjectCreate): Promise<Project> => {
    const items = load<Project>(KEY)
    const project: Project = {
      id: nextId(items),
      client_id: data.client_id,
      name: data.name,
      description: data.description ?? null,
      hourly_rate: data.hourly_rate ?? null,
      currency: data.currency ?? 'RUB',
      status: data.status ?? 'active',
      created_at: nowISO(),
    }
    save(KEY, [...items, project])
    return Promise.resolve(project)
  },

  update: (id: number, data: ProjectUpdate): Promise<Project> => {
    const items = load<Project>(KEY)
    const idx = items.findIndex(p => p.id === id)
    if (idx === -1) return Promise.reject(new Error('Проект не найден'))
    const updated: Project = { ...items[idx], ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) }
    items[idx] = updated
    save(KEY, items)
    return Promise.resolve(updated)
  },

  delete: (id: number): Promise<void> => {
    save(KEY, load<Project>(KEY).filter(p => p.id !== id))
    return Promise.resolve()
  },
}
