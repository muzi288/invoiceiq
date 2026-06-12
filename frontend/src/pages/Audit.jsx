import { useState } from 'react'
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
}

export default function Audit() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page],
    queryFn: () => getAuditLog({ page, limit: 50 }),
    select: (res) => res.data,
  })

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-gray-400 text-sm mt-1">
          Every action, every user, timestamped
        </p>
      </div>

      {isLoading && (
        <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wider">Action</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wider">Invoice</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wider">Time</th>
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
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                  {log.user_id.slice(0, 8)}...
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                  {log.invoice_id ? log.invoice_id.slice(0, 8) + '...' : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(log.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.items?.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No audit entries yet
          </div>
        )}
      </div>

      {data?.pages > 1 && (
        <div className="flex gap-2 mt-4 justify-center">
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
