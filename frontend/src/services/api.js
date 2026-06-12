import axios from 'axios'

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const register = (data) => api.post('/auth/register', data)
export const login = (data) => api.post('/auth/login', data)
export const logout = () => api.post('/auth/logout')

// Invoices
export const getInvoices = (params) => api.get('/invoices', { params })
export const getInvoice = (id) => api.get(`/invoices/${id}`)
export const uploadInvoice = (formData) => api.post('/invoices/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const approveInvoice = (id) => api.patch(`/invoices/${id}/approve`)
export const rejectInvoice = (id, reason) => api.patch(`/invoices/${id}/reject`, { reason })
export const updateExtracted = (id, data) => api.patch(`/invoices/${id}/extracted`, data)

// Audit
export const getAuditLog = (params) => api.get('/audit', { params })

// Settings
export const getSettings = () => api.get('/settings')
export const updateSettings = (data) => api.patch('/settings', data)

export default api
