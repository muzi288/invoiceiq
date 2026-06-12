import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { completeOnboarding } from '../services/api'
import useAuthStore from '../store/authStore'

const CURRENCIES = ['USD', 'ZAR', 'EUR', 'GBP', 'KES', 'NGN', 'BWP']
const TIMEZONES = [
  'Africa/Harare',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'UTC',
  'Europe/London',
  'America/New_York',
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, setAuth, token } = useAuthStore()
  const [form, setForm] = useState({
    default_currency: 'ZAR',
    timezone: 'Africa/Harare',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => completeOnboarding(form),
    onSuccess: () => {
      setAuth(token, { ...user, onboarding_completed: true })
      navigate('/dashboard')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Setup failed'),
  })

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Welcome to InvoiceIQ</h1>
        <p className="text-gray-400 text-sm mb-6">
          Set your reporting currency and timezone. Dashboard and vendor totals will use this currency.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
          className="space-y-4"
        >
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 text-sm rounded">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Default currency</label>
            <select
              value={form.default_currency}
              onChange={(e) => setForm({ ...form, default_currency: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 rounded text-sm disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Continue to dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}
