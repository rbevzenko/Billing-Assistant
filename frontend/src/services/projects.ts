import api from './api'
import type { Page, Project, ProjectCreate, ProjectDetail, ProjectUpdate, ProjectStatus } from '@/types'

export const projectsService = {
  list: (params: { client_id?: number; status?: ProjectStatus; page?: number; size?: number }) =>
    api.get<Page<Project>>('/projects', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<ProjectDetail>(`/projects/${id}`).then(r => r.data),

  create: (data: ProjectCreate) =>
    api.post<Project>('/projects', data).then(r => r.data),

  update: (id: number, data: ProjectUpdate) =>
    api.put<Project>(`/projects/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/projects/${id}`),
}
