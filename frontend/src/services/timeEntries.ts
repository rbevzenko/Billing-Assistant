import api from './api'
import type { BulkConfirmResponse, Page, TimeEntry, TimeEntryCreate, TimeEntryStatus, TimeEntryUpdate } from '@/types'

export const timeEntriesService = {
  list: (params: {
    client_id?: number
    project_id?: number
    date_from?: string
    date_to?: string
    status?: TimeEntryStatus
    page?: number
    size?: number
  }) =>
    api.get<Page<TimeEntry>>('/time-entries', { params }).then(r => r.data),

  create: (data: TimeEntryCreate) =>
    api.post<TimeEntry>('/time-entries', data).then(r => r.data),

  update: (id: number, data: TimeEntryUpdate) =>
    api.put<TimeEntry>(`/time-entries/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/time-entries/${id}`),

  confirm: (id: number) =>
    api.post<TimeEntry>(`/time-entries/${id}/confirm`).then(r => r.data),

  bulkConfirm: (ids: number[]) =>
    api.post<BulkConfirmResponse>('/time-entries/bulk-confirm', { time_entry_ids: ids }).then(r => r.data),
}
