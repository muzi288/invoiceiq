import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function Layout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-bold text-amber-400 tracking-tight">
              InvoiceIQ
            </span>
            <div className="flex gap-6">
              <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
                Invoices
              </Link>
              <Link to="/upload" className="text-sm text-gray-400 hover:text-white transition-colors">
                Upload
              </Link>
              {user?.role === 'owner' && (
                <Link to="/audit" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Audit Log
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
