import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { login } from '../services/api'
import useAuthStore from '../store/authStore'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const registered = searchParams.get('registered') === 'true'
  const reset = searchParams.get('reset') === '1'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await login(form)
      const token = res.data.access_token

      // Decode JWT to get user info
      const payload = JSON.parse(atob(token.split('.')[1]))
      const mustChange = res.data.must_change_password || payload.must_change_password
      const emailVerified = res.data.email_verified ?? payload.email_verified ?? true
      const onboardingDone = res.data.onboarding_completed ?? payload.onboarding_completed ?? true
      setAuth(token, {
        user_id: payload.user_id,
        tenant_id: payload.tenant_id,
        role: payload.role,
        can_approve: payload.can_approve,
        can_export: payload.can_export,
        email: form.email,
        must_change_password: !!mustChange,
        email_verified: !!emailVerified,
        onboarding_completed: !!onboardingDone,
      })
      if (mustChange) navigate('/profile?setup=1')
      else if (payload.role === 'owner' && !onboardingDone) navigate('/onboarding')
      else navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">InvoiceIQ</h1>
          <p className="text-gray-400 text-sm">Sign in to your account</p>
        </div>
        {registered && (
          <div className="bg-amber-900/30 border border-amber-700 text-amber-300 px-4 py-3 text-sm rounded mb-4">
            Account created. Check your email to verify, then sign in.
          </div>
        )}
        {reset && (
          <div className="bg-green-900/30 border border-green-700 text-green-400 px-4 py-3 text-sm rounded mb-4">
            Password updated. You can sign in now.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 text-sm rounded">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-amber-500"
              required
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm text-gray-400">Password</label>
              <Link to="/forgot-password" className="text-xs text-amber-400 hover:text-amber-300">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-amber-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 px-4 rounded text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          No account?{' '}
          <Link to="/register" className="text-amber-400 hover:text-amber-300">
            Register your company
          </Link>
        </p>
      </div>
    </div>
  )
}
