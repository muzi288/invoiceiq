import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../services/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Reset password</h1>
        <p className="text-gray-400 text-sm mb-6">
          Enter your email and we&apos;ll send reset instructions.
        </p>

        {sent ? (
          <div className="bg-green-900/30 border border-green-700 text-green-400 px-4 py-3 text-sm rounded mb-4">
            If that email is registered, check your inbox (or the backend console in dev).
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 text-sm rounded">
                {error}
              </div>
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 rounded text-sm disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-amber-400 hover:text-amber-300">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
