import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getInvoices } from '../services/api'
import Layout from '../components/Layout'

const STATUS_COLORS = {
  pending_review: 'bg-yellow-900/40 text-yellow-400 border-yellow-700',
  approved: 'bg-green-900/40 text-green-400 border-green-700',
  rejected: 'bg-red-900/40 text-red-400 border-red-700',
}

const EXTRACTION_COLORS = {
  pending: 'text-gray-500',
  processing: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
}

export default function Dashboard() {
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', page, statusFilter],
    queryFn: () => getInvoices({ page, limit: 20, status: statusFilter || undefined }),
    select: (res) => res.data,
  })

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-gray-400 text-sm mt-1">
            {data?.total || 0} total invoices
          </p>
        </div>
        <Link
          to="/upload"
          className="bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 px-4 rounded text-sm transition-colors"
        >
          Upload Invoice
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {['', 'pending_review', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-amber-500 text-black'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {s === '' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
      )}

      {error && (
        <div className="text-red-400 text-sm py-8 text-center">
          Failed to load invoices
        </div>
      )}

      {data?.items?.length === 0 && !isLoading && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm">No invoices yet</p>
          <Link to="/upload" className="text-amber-400 text-sm mt-2 inline-block">
            Upload your first invoice →
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {data?.items?.map((invoice) => (
          <Link
            key={invoice.id}
            to={`/invoices/${invoice.id}`}
            className="block bg-gray-900 border border-gray-800 hover:border-gray-600 rounded p-4 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[invoice.status]}`}>
                  {invoice.status.replace('_', ' ')}
                </span>
                <span className="text-sm text-white font-medium">
                  {invoice.category}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-xs ${EXTRACTION_COLORS[invoice.extraction_status]}`}>
                  {invoice.extraction_status}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(invoice.upload_date).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {data?.pages > 1 && (
        <div className="flex gap-2 mt-6 justify-center">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-gray-800 text-gray-400 rounded text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-gray-400 text-sm">
            {page} / {data.pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(data.pages, p + 1))}
            disabled={page === data.pages}
            className="px-3 py-1 bg-gray-800 text-gray-400 rounded text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </Layout>
  )
}
