import api from './api'
import type { Invoice, InvoiceCreate, InvoiceStatus, InvoiceUpdate, Page } from '@/types'

export const invoicesService = {
  list: (params: {
    client_id?: number
    status?: InvoiceStatus
    date_from?: string
    date_to?: string
    page?: number
    size?: number
  }) =>
    api.get<Page<Invoice>>('/invoices', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Invoice>(`/invoices/${id}`).then(r => r.data),

  create: (data: InvoiceCreate) =>
    api.post<Invoice>('/invoices', data).then(r => r.data),

  update: (id: number, data: InvoiceUpdate) =>
    api.put<Invoice>(`/invoices/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/invoices/${id}`),

  send: (id: number) =>
    api.post<Invoice>(`/invoices/${id}/send`).then(r => r.data),

  pay: (id: number) =>
    api.post<Invoice>(`/invoices/${id}/pay`).then(r => r.data),

  downloadPdf: async (id: number, invoiceNumber: string) => {
    const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoiceNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
