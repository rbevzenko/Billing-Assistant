import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Extract FastAPI `detail` field from error responses so pages can show it
api.interceptors.response.use(
  response => response,
  error => {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') {
      error.message = detail
    } else if (Array.isArray(detail) && detail.length > 0) {
      // Pydantic validation errors come as array of objects with `msg`
      error.message = detail.map((d: { msg?: string }) => d.msg ?? String(d)).join('; ')
    }
    return Promise.reject(error)
  }
)

export default api
