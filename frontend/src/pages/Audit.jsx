import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAuditLog } from '../services/api'
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
  '', 'uploaded', 'approved', 'rejected', 'edited', 'exported',
  'extraction_completed', 'extraction_failed', 're_extract_requested',
]

export default function Audit() {
  const [searchParams] = useSearchParams()
  const invoiceIdParam = searchParams.get('invoice_id') || ''
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [invoiceFilter, setInvoiceFilter] = useState(invoiceIdParam)

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, actionFilter, invoiceFilter],
    queryFn: () => getAuditLog({
      page,
      limit: 50,
      action: actionFilter || undefined,
      invoice_id: invoiceFilter || undefined,
    }),
    select: (res) => res.data,
  })

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-gray-400 text-sm mt-1">Every action, every user, timestamped</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
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
          type="text"
          value={invoiceFilter}
          onChange={(e) => { setInvoiceFilter(e.target.value); setPage(1) }}
          placeholder="Filter by invoice ID..."
          className="bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 rounded flex-1 min-w-[200px]"
        />
      </div>

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
            {data?.items?.map((log) => (
              <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <span className={`font-medium ${ACTION_COLORS[log.action] || 'text-gray-400'}`}>
                    {log.action.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white text-sm">{log.user_name || '—'}</div>
                  <div className="text-gray-500 text-xs capitalize">{log.user_role}</div>
                </td>
                <td className="px-4 py-3">
                  {log.invoice_id ? (
                    <Link
                      to={`/invoices/${log.invoice_id}`}
                      className="text-amber-400 hover:text-amber-300 text-sm"
                    >
                      {log.invoice_label || 'View invoice'}
                    </Link>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                  {log.extra_data && Object.keys(log.extra_data).length > 0
                    ? JSON.stringify(log.extra_data)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.items?.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500 text-sm">No audit entries</div>
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
