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

const CATEGORIES = [
  '', 'uncategorised', 'inventory', 'utilities', 'equipment',
  'payroll', 'travel', 'office', 'other',
]

export default function Dashboard() {
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', page, statusFilter, categoryFilter, search, dateFrom, dateTo],
    queryFn: () => getInvoices({
      page,
      limit: 20,
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
      search: search || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    select: (res) => res.data,
  })

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-gray-400 text-sm mt-1">
            {data?.total ?? 0} total invoices
          </p>
        </div>
        <Link
          to="/upload"
          className="bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 px-4 rounded text-sm transition-colors"
        >
          Upload Invoice
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search vendor or invoice number..."
          className="flex-1 bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-amber-500"
        />
        <button type="submit" className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded text-sm">
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
            className="text-gray-500 hover:text-white text-sm px-2"
          >
            Clear
          </button>
        )}
      </form>

      <div className="flex flex-wrap gap-2 mb-4">
        {['', 'pending_review', 'approved', 'rejected'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              statusFilter === s ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {s === '' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-3 py-1 rounded"
        >
          <option value="">All categories</option>
          {CATEGORIES.filter(Boolean).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded"
          title="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded"
          title="To date"
        />
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
            className="text-gray-500 hover:text-white text-xs px-2"
          >
            Clear dates
          </button>
        )}
      </div>

      {isLoading && <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>}
      {error && <div className="text-red-400 text-sm py-8 text-center">Failed to load invoices</div>}

      {data?.items?.length === 0 && !isLoading && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm">No invoices found</p>
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
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${STATUS_COLORS[invoice.status]}`}>
                    {invoice.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{invoice.category}</span>
                </div>
                <p className="text-white font-medium truncate">
                  {invoice.vendor_name || 'Processing...'}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {invoice.invoice_number ? `#${invoice.invoice_number}` : 'No invoice number'}
                  {invoice.uploaded_by_name && ` · ${invoice.uploaded_by_name}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                {invoice.total_amount != null && (
                  <p className="text-white font-medium text-sm">
                    {invoice.currency} {Number(invoice.total_amount).toLocaleString()}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(invoice.upload_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {data?.pages > 1 && (
        <div className="flex gap-2 mt-6 justify-center">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-gray-800 text-gray-400 rounded text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-gray-400 text-sm">{page} / {data.pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
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
