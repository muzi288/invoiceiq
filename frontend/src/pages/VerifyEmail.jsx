import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyEmail } from '../services/api'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Invalid verification link.')
      return
    }
    verifyEmail(token)
      .then((res) => {
        setStatus('success')
        setMessage(res.data.message)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.response?.data?.detail || 'Verification failed')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {status === 'loading' && <p className="text-gray-400 text-sm">Verifying your email...</p>}
        {status === 'success' && (
          <>
            <p className="text-green-400 text-sm mb-4">{message}</p>
            <Link to="/login" className="text-amber-400 text-sm">Sign in</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-400 text-sm mb-4">{message}</p>
            <Link to="/login" className="text-amber-400 text-sm">Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  )
}
