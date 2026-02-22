import api from './api'
import type { Client, ClientCreate, ClientUpdate, Page } from '@/types'

export const clientsService = {
  list: (params: { search?: string; page?: number; size?: number }) =>
    api.get<Page<Client>>('/clients', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Client>(`/clients/${id}`).then(r => r.data),

  create: (data: ClientCreate) =>
    api.post<Client>('/clients', data).then(r => r.data),

  update: (id: number, data: ClientUpdate) =>
    api.put<Client>(`/clients/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/clients/${id}`),
}
