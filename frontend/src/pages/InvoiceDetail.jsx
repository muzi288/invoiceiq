import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInvoice, approveInvoice, rejectInvoice, updateExtracted } from '../services/api'
import useAuthStore from '../store/authStore'
import Layout from '../components/Layout'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id),
    select: (res) => res.data,
    refetchInterval: (data) =>
      data?.invoice?.extraction_status === 'completed' ||
      data?.invoice?.extraction_status === 'failed'
        ? false
        : 2000,
  })

  const approveMutation = useMutation({
    mutationFn: () => approveInvoice(id),
    onSuccess: () => queryClient.invalidateQueries(['invoice', id]),
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectInvoice(id, rejectReason),
    onSuccess: () => {
      queryClient.invalidateQueries(['invoice', id])
      setShowReject(false)
    },
  })

  const editMutation = useMutation({
    mutationFn: (data) => updateExtracted(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['invoice', id])
      setEditing(false)
    },
  })

  if (isLoading) return (
    <Layout>
      <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
    </Layout>
  )

  if (error) return (
    <Layout>
      <div className="text-red-400 text-sm py-8 text-center">Failed to load invoice</div>
    </Layout>
  )

  const { invoice, extracted_data, line_items, signed_url } = data
  const canApprove = user?.role === 'owner' || user?.can_approve
  const isExtracting = !['completed', 'failed'].includes(invoice.extraction_status)

  const startEdit = () => {
    setEditForm({
      vendor_name: extracted_data?.vendor_name || '',
      invoice_number: extracted_data?.invoice_number || '',
      total_amount: extracted_data?.total_amount || '',
      currency: extracted_data?.currency || 'USD',
    })
    setEditing(true)
  }

  return (
    <Layout>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">
            {extracted_data?.vendor_name || 'Invoice'}
          </h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Uploaded {new Date(invoice.upload_date).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isExtracting && (
            <span className="text-blue-400 text-xs animate-pulse">
              Extracting...
            </span>
          )}
          <span className={`text-xs px-2 py-1 rounded border ${
            invoice.status === 'approved'
              ? 'bg-green-900/40 text-green-400 border-green-700'
              : invoice.status === 'rejected'
              ? 'bg-red-900/40 text-red-400 border-red-700'
              : 'bg-yellow-900/40 text-yellow-400 border-yellow-700'
          }`}>
            {invoice.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left — file viewer */}
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                Original Document
              </span>
            </div>
            {signed_url ? (
              invoice.file_type === 'pdf' ? (
                <iframe
                  src={signed_url}
                  className="w-full h-96"
                  title="Invoice"
                />
              ) : (
                <img
                  src={signed_url}
                  alt="Invoice"
                  className="w-full object-contain max-h-96"
                />
              )
            ) : (
              <div className="h-96 flex items-center justify-center text-gray-600 text-sm">
                {isExtracting ? 'Processing...' : 'File not available'}
              </div>
            )}
          </div>
        </div>

        {/* Right — extracted data */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded">
            <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                Extracted Data
              </span>
              {extracted_data && !editing && invoice.status === 'pending_review' && (
                <button
                  onClick={startEdit}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  Edit
                </button>
              )}
            </div>

            {isExtracting ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                AI extraction in progress...
              </div>
            ) : invoice.extraction_status === 'failed' ? (
              <div className="p-4 text-center text-red-400 text-sm">
                Extraction failed: {invoice.extraction_error}
              </div>
            ) : extracted_data ? (
              <div className="p-4 space-y-3">
                {editing ? (
                  <div className="space-y-3">
                    {Object.entries(editForm).map(([key, val]) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-500 mb-1 capitalize">
                          {key.replace('_', ' ')}
                        </label>
                        <input
                          value={val}
                          onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-700 text-white px-2 py-1 rounded text-sm"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => editMutation.mutate(editForm)}
                        className="flex-1 bg-amber-500 text-black text-xs py-1.5 rounded font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="flex-1 bg-gray-800 text-gray-400 text-xs py-1.5 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {[
                      ['Vendor', extracted_data.vendor_name],
                      ['Invoice #', extracted_data.invoice_number],
                      ['Date', extracted_data.invoice_date],
                      ['Due Date', extracted_data.due_date],
                      ['Subtotal', extracted_data.subtotal],
                      ['Tax', extracted_data.tax_amount],
                      ['Total', extracted_data.total_amount],
                      ['Currency', extracted_data.currency],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-xs text-gray-500">{label}</span>
                        <span className="text-sm text-white">
                          {value ?? '—'}
                        </span>
                      </div>
                    ))}
                    {extracted_data.confidence_score && (
                      <div className="pt-2 border-t border-gray-800">
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Confidence</span>
                          <span className="text-xs text-gray-400">
                            {(extracted_data.confidence_score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">
                No extraction data
              </div>
            )}
          </div>

          {line_items?.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded">
              <div className="px-4 py-2 border-b border-gray-800">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                  Line Items
                </span>
              </div>
              <div className="p-4 space-y-2">
                {line_items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-300">{item.description}</span>
                    <span className="text-white">{item.total_price}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canApprove && invoice.status === 'pending_review' &&
           invoice.extraction_status === 'completed' && (
            <div className="flex gap-2">
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm py-2 rounded font-medium transition-colors disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded font-medium transition-colors"
              >
                Reject
              </button>
            </div>
          )}

          {showReject && (
            <div className="bg-gray-900 border border-gray-800 rounded p-4 space-y-3">
              <label className="block text-sm text-gray-400">
                Reason for rejection
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded text-sm resize-none"
                rows={3}
                placeholder="Optional reason..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => rejectMutation.mutate()}
                  className="flex-1 bg-red-700 hover:bg-red-600 text-white text-sm py-1.5 rounded"
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => setShowReject(false)}
                  className="flex-1 bg-gray-800 text-gray-400 text-sm py-1.5 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
