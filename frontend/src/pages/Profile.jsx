import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { changePassword } from '../services/api'
import useAuthStore from '../store/authStore'
import Layout from '../components/Layout'

function parseJwt(token) {
  return JSON.parse(atob(token.split('.')[1]))
}

export default function Profile() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const forced = searchParams.get('setup') === '1'
  const { user, setAuth } = useAuthStore()
  const [form, setForm] = useState({ current: '', newPassword: '', confirm: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const mutation = useMutation({
    mutationFn: () => changePassword({
      current_password: form.current,
      new_password: form.newPassword,
    }),
    onSuccess: (res) => {
      const token = res.data.access_token
      const payload = parseJwt(token)
      setAuth(token, {
        ...user,
        user_id: payload.user_id,
        must_change_password: false,
      })
      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 1500)
    },
    onError: (err) => setError(err.response?.data?.detail || 'Password change failed'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (form.newPassword !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    mutation.mutate()
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-white mb-2">
        {forced ? 'Set your password' : 'Profile'}
      </h1>
      {forced && (
        <p className="text-amber-400 text-sm mb-6">
          Change your temporary password to continue.
        </p>
      )}
      {!forced && user?.email && (
        <p className="text-gray-500 text-sm mb-6">{user.email}</p>
      )}

      {success ? (
        <p className="text-green-400 text-sm">Password updated. Redirecting...</p>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-md space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 text-sm rounded">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Current password</label>
            <input
              type="password"
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">New password</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Confirm new password</label>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 px-6 rounded text-sm disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Update password'}
          </button>
        </form>
      )}
    </Layout>
  )
}
