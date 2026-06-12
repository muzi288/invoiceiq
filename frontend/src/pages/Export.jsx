import { useState } from 'react'
import { exportInvoices } from '../services/api'
import useAuthStore from '../store/authStore'
import Layout from '../components/Layout'

const CATEGORIES = [
  '', 'uncategorised', 'inventory', 'utilities', 'equipment',
  'payroll', 'travel', 'office', 'other',
]

export default function Export() {
  const { user } = useAuthStore()
  const [category, setCategory] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canExport = user?.role === 'owner' || user?.can_export

  const handleExport = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await exportInvoices({
        category: category || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoices_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.detail || 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  if (!canExport) {
    return (
      <Layout>
        <p className="text-gray-500 text-sm">You do not have permission to export invoices.</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-white mb-2">Export</h1>
      <p className="text-gray-400 text-sm mb-6">Download approved invoices as CSV</p>

      {error && <div className="text-red-400 text-sm mb-4">{error}</div>}

      <div className="max-w-md space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.filter(Boolean).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm" />
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 px-6 rounded text-sm disabled:opacity-50"
        >
          {loading ? 'Exporting...' : 'Download CSV'}
        </button>
      </div>
    </Layout>
  )
}
