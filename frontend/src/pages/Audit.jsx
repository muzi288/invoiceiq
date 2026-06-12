import { useState, Fragment } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAuditLog, getUsers } from '../services/api'
import Layout from '../components/Layout'

const ACTION_COLORS = {
  uploaded: 'text-blue-400',
  approved: 'text-green-400',
  rejected: 'text-red-400',
  edited: 'text-yellow-400',
  exported: 'text-purple-400',
  deleted: 'text-red-500',
  user_created: 'text-blue-300',
  permission_granted: 'text-amber-400',
  extraction_completed: 'text-green-300',
  extraction_failed: 'text-red-300',
  re_extract_requested: 'text-blue-400',
  line_items_edited: 'text-yellow-300',
  invoice_metadata_edited: 'text-gray-300',
}

const ACTIONS = [
  '', 'uploaded', 'approved', 'rejected', 'edited', 'exported', 'deleted',
  'extraction_completed', 'extraction_failed', 're_extract_requested',
  'line_items_edited', 'invoice_metadata_edited', 'user_created', 'permission_granted',
]

export default function Audit() {
  const [searchParams, setSearchParams] = useSearchParams()
  const invoiceIdFromUrl = searchParams.get('invoice_id') || ''
  const invoiceLabelFromUrl = searchParams.get('invoice_label') || ''

  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoiceSearchInput, setInvoiceSearchInput] = useState('')
  const [pinnedInvoiceId, setPinnedInvoiceId] = useState(invoiceIdFromUrl)
  const [pinnedInvoiceLabel, setPinnedInvoiceLabel] = useState(invoiceLabelFromUrl)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
    select: (res) => res.data,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, actionFilter, userFilter, pinnedInvoiceId, invoiceSearch, dateFrom, dateTo],
    queryFn: () => getAuditLog({
      page,
      limit: 50,
      action: actionFilter || undefined,
      user_id: userFilter || undefined,
      invoice_id: pinnedInvoiceId || undefined,
      invoice_search: !pinnedInvoiceId && invoiceSearch ? invoiceSearch : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    select: (res) => res.data,
  })

  const applyInvoiceSearch = (e) => {
    e.preventDefault()
    clearPinnedInvoice()
    setInvoiceSearch(invoiceSearchInput)
    setPage(1)
  }

  const clearPinnedInvoice = () => {
    setPinnedInvoiceId('')
    setPinnedInvoiceLabel('')
    if (searchParams.has('invoice_id')) {
      searchParams.delete('invoice_id')
      searchParams.delete('invoice_label')
      setSearchParams(searchParams)
    }
  }

  const clearAllFilters = () => {
    setActionFilter('')
    setUserFilter('')
    setInvoiceSearch('')
    setInvoiceSearchInput('')
    clearPinnedInvoice()
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const hasFilters = actionFilter || userFilter || pinnedInvoiceId || invoiceSearch || dateFrom || dateTo

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-gray-400 text-sm mt-1">Every action, every user, timestamped</p>
      </div>

      {pinnedInvoiceId && (
        <div className="flex items-center gap-2 mb-4 bg-amber-900/20 border border-amber-800/50 rounded px-3 py-2">
          <span className="text-amber-400 text-sm">
            Showing activity for: <strong>{pinnedInvoiceLabel || 'Invoice'}</strong>
          </span>
          <Link to={`/invoices/${pinnedInvoiceId}`} className="text-xs text-amber-300 hover:text-amber-200">
            Open invoice →
          </Link>
          <button type="button" onClick={clearPinnedInvoice} className="text-xs text-gray-400 hover:text-white ml-auto">
            Clear
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={userFilter}
          onChange={(e) => { setUserFilter(e.target.value); setPage(1) }}
          className="bg-gray-900 border border-gray-700 text-gray-300 text-sm px-3 py-2 rounded"
        >
          <option value="">All users</option>
          {usersData?.items?.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
          ))}
        </select>

        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
          className="bg-gray-900 border border-gray-700 text-gray-300 text-sm px-3 py-2 rounded"
        >
          <option value="">All actions</option>
          {ACTIONS.filter(Boolean).map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          className="bg-gray-900 border border-gray-700 text-gray-300 text-sm px-2 py-2 rounded"
          title="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          className="bg-gray-900 border border-gray-700 text-gray-300 text-sm px-2 py-2 rounded"
          title="To date"
        />
      </div>

      {!pinnedInvoiceId && (
        <form onSubmit={applyInvoiceSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={invoiceSearchInput}
            onChange={(e) => setInvoiceSearchInput(e.target.value)}
            placeholder="Search by vendor name or invoice number..."
            className="flex-1 bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 rounded min-w-[200px]"
          />
          <button type="submit" className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded text-sm">
            Search invoices
          </button>
          {invoiceSearch && (
            <button
              type="button"
              onClick={() => { setInvoiceSearch(''); setInvoiceSearchInput(''); setPage(1) }}
              className="text-gray-500 hover:text-white text-sm px-2"
            >
              Clear
            </button>
          )}
        </form>
      )}

      {invoiceSearch && !pinnedInvoiceId && (
        <p className="text-gray-500 text-xs mb-4">
          Showing audit entries for invoices matching &ldquo;{invoiceSearch}&rdquo;
        </p>
      )}

      {hasFilters && (
        <button type="button" onClick={clearAllFilters} className="text-xs text-gray-500 hover:text-white mb-4">
          Clear all filters
        </button>
      )}

      {isLoading && <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>}

      <div className="bg-gray-900 border border-gray-800 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase">Action</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase">User</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase">Invoice</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase">Details</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase">Time</th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((log) => {
              const hasDetails = log.extra_data && Object.keys(log.extra_data).length > 0
              const isExpanded = expandedId === log.id
              return (
                <Fragment key={log.id}>
                  <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className={`font-medium ${ACTION_COLORS[log.action] || 'text-gray-400'}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => { setUserFilter(log.user_id); setPage(1) }}
                        className="text-left hover:text-amber-400 transition-colors"
                        title="Filter by this user"
                      >
                        <div className="text-white text-sm">{log.user_name || '—'}</div>
                        <div className="text-gray-500 text-xs capitalize">{log.user_role}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {log.invoice_id ? (
                        <div className="flex flex-col gap-1">
                          <Link to={`/invoices/${log.invoice_id}`} className="text-amber-400 hover:text-amber-300 text-sm">
                            {log.invoice_label || 'View invoice'}
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setPinnedInvoiceId(log.invoice_id)
                              setPinnedInvoiceLabel(log.invoice_label || 'Invoice')
                              setInvoiceSearch('')
                              setInvoiceSearchInput('')
                              setPage(1)
                            }}
                            className="text-gray-600 hover:text-gray-400 text-xs text-left"
                          >
                            Filter this invoice
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">
                      {hasDetails ? (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="text-amber-400 hover:text-amber-300"
                        >
                          {isExpanded ? 'Hide' : 'Show'} details
                        </button>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                  {isExpanded && hasDetails && (
                    <tr className="bg-gray-800/20">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="text-xs text-gray-400 whitespace-pre-wrap overflow-x-auto">
                          {JSON.stringify(log.extra_data, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {data?.items?.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500 text-sm">No audit entries match your filters</div>
        )}
      </div>

      {data?.pages > 1 && (
        <div className="flex gap-2 mt-4 justify-center">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 bg-gray-800 text-gray-400 rounded text-sm disabled:opacity-50">Previous</button>
          <span className="px-3 py-1 text-gray-400 text-sm">{page} / {data.pages}</span>
          <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page === data.pages}
            className="px-3 py-1 bg-gray-800 text-gray-400 rounded text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </Layout>
  )
}
