import api from './api'
import type { ReportData } from '@/types'

export interface ReportParams {
  date_from: string
  date_to: string
  client_id?: number | null
}

export const reportsService = {
  get: (params: ReportParams) =>
    api.get<ReportData>('/reports', { params }).then(r => r.data),

  downloadPdf: async (params: ReportParams) => {
    const response = await api.get('/reports/pdf', {
      params,
      responseType: 'blob',
    })
    const url = URL.createObjectURL(
      new Blob([response.data], { type: 'application/pdf' })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${params.date_from}_${params.date_to}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
