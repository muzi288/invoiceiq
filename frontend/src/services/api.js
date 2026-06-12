import axios from 'axios'

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

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
export const changePassword = (data) => api.post('/auth/change-password', data)
export const verifyEmail = (token) => api.get('/auth/verify-email', { params: { token } })
export const resendVerification = (email) => api.post('/auth/resend-verification', { email })
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email })
export const resetPassword = (data) => api.post('/auth/reset-password', data)

// Invoices
export const getInvoices = (params) => api.get('/invoices', { params })
export const getInvoice = (id) => api.get(`/invoices/${id}`)
export const getInvoiceFile = (id) => api.get(`/invoices/${id}/file`, { responseType: 'blob' })
export const uploadInvoice = (formData) => api.post('/invoices/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const approveInvoice = (id) => api.patch(`/invoices/${id}/approve`)
export const rejectInvoice = (id, reason) => api.patch(`/invoices/${id}/reject`, { reason })
export const updateExtracted = (id, data) => api.patch(`/invoices/${id}/extracted`, data)
export const updateLineItems = (id, line_items) => api.put(`/invoices/${id}/line-items`, { line_items })
export const reExtractInvoice = (id) => api.post(`/invoices/${id}/re-extract`)
export const updateInvoice = (id, data) => api.patch(`/invoices/${id}`, data)
export const deleteInvoice = (id) => api.delete(`/invoices/${id}`)

// Vendors
export const getVendors = () => api.get('/vendors')
export const getVendor = (id) => api.get(`/vendors/${id}`)

// Users / Team
export const getMe = () => api.get('/users/me')
export const getUsers = () => api.get('/users')
export const inviteUser = (data) => api.post('/users/invite', data)
export const updateUserPermissions = (userId, data) => api.patch(`/users/${userId}/permissions`, data)
export const deactivateUser = (userId) => api.delete(`/users/${userId}`)

// Audit
export const getAuditLog = (params) => api.get('/audit', { params })

// Settings
export const getSettings = () => api.get('/settings')
export const updateSettings = (data) => api.patch('/settings', data)
export const completeOnboarding = (data) => api.post('/settings/onboarding', data)

// Export
export const exportInvoices = (params) => api.get('/exports/invoices', {
  params,
  responseType: 'blob',
})

export default api
