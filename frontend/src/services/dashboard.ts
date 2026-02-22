import api from './api'
import type { DashboardData } from '@/types'

export const dashboardService = {
  get: () => api.get<DashboardData>('/dashboard').then(r => r.data),
}
