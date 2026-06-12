import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function Layout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const isOwner = user?.role === 'owner'
  const canExport = isOwner || user?.can_export

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const linkClass = 'text-sm text-gray-400 hover:text-white transition-colors'

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6 overflow-x-auto">
            <span className="font-bold text-amber-400 tracking-tight shrink-0">InvoiceIQ</span>
            <div className="flex gap-4 shrink-0">
              <Link to="/dashboard" className={linkClass}>Invoices</Link>
              <Link to="/upload" className={linkClass}>Upload</Link>
              <Link to="/vendors" className={linkClass}>Vendors</Link>
              {canExport && <Link to="/export" className={linkClass}>Export</Link>}
              {isOwner && <Link to="/team" className={linkClass}>Team</Link>}
              {isOwner && <Link to="/audit" className={linkClass}>Audit</Link>}
              <Link to="/settings" className={linkClass}>Settings</Link>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs text-gray-500 hidden sm:inline">{user?.email}</span>
            <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-white transition-colors">
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
