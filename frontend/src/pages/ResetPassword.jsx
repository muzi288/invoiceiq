import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { resetPassword } from '../services/api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await resetPassword({ token, new_password: password })
      navigate('/login?reset=1')
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <p className="text-red-400 text-sm">Invalid reset link.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6">Choose a new password</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 text-sm rounded">
              {error}
            </div>
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm"
            required
            minLength={8}
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 rounded text-sm disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Update password'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-amber-400">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
