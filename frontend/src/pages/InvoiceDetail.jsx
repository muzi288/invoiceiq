import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getInvoice, getInvoiceFile, approveInvoice, rejectInvoice,
  updateExtracted, updateLineItems, reExtractInvoice,
} from '../services/api'
import useAuthStore from '../store/authStore'
import Layout from '../components/Layout'

const EXTRACTED_FIELDS = [
  { key: 'vendor_name', label: 'Vendor', type: 'text' },
  { key: 'invoice_number', label: 'Invoice #', type: 'text' },
  { key: 'invoice_date', label: 'Invoice date', type: 'date' },
  { key: 'due_date', label: 'Due date', type: 'date' },
  { key: 'subtotal', label: 'Subtotal', type: 'number' },
  { key: 'tax_amount', label: 'Tax', type: 'number' },
  { key: 'total_amount', label: 'Total', type: 'number' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'payment_terms', label: 'Payment terms', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'text' },
]

const EMPTY_LINE = { description: '', quantity: '', unit_price: '', total_price: '', currency: 'USD' }

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editingLines, setEditingLines] = useState(false)
  const [lineForm, setLineForm] = useState([])
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id),
    select: (res) => res.data,
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.invoice?.extraction_status
      return status === 'completed' || status === 'failed' ? false : 2000
    },
  })

  const { data: fileBlob, isLoading: fileLoading, error: fileError } = useQuery({
    queryKey: ['invoice-file', id],
    queryFn: () => getInvoiceFile(id),
    select: (res) => res.data,
    enabled: !!id && !!data?.invoice,
    staleTime: Infinity,
  })

  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => {
    if (!fileBlob) return
    const url = URL.createObjectURL(fileBlob)
    setFileUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [fileBlob])

  const invalidate = () => {
    queryClient.invalidateQueries(['invoice', id])
    queryClient.invalidateQueries(['invoices'])
  }

  const approveMutation = useMutation({
    mutationFn: () => approveInvoice(id),
    onSuccess: invalidate,
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectInvoice(id, rejectReason),
    onSuccess: () => { invalidate(); setShowReject(false) },
  })

  const editMutation = useMutation({
    mutationFn: (payload) => updateExtracted(id, payload),
    onSuccess: () => { invalidate(); setEditing(false) },
  })

  const lineMutation = useMutation({
    mutationFn: (items) => updateLineItems(id, items),
    onSuccess: () => { invalidate(); setEditingLines(false) },
  })

  const reExtractMutation = useMutation({
    mutationFn: () => reExtractInvoice(id),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries(['invoice-file', id])
    },
  })

  if (isLoading) return <Layout><div className="text-gray-400 text-sm py-8 text-center">Loading...</div></Layout>
  if (error) return <Layout><div className="text-red-400 text-sm py-8 text-center">Failed to load invoice</div></Layout>

  const { invoice, extracted_data, line_items } = data
  const canApprove = user?.role === 'owner' || user?.can_approve
  const isExtracting = !['completed', 'failed'].includes(invoice.extraction_status)
  const canEdit = invoice.status === 'pending_review' && extracted_data

  const startEdit = () => {
    const form = {}
    EXTRACTED_FIELDS.forEach(({ key }) => {
      form[key] = extracted_data?.[key] ?? ''
    })
    setEditForm(form)
    setEditing(true)
  }

  const startLineEdit = () => {
    setLineForm(
      line_items?.length
        ? line_items.map((item) => ({
            description: item.description || '',
            quantity: item.quantity ?? '',
            unit_price: item.unit_price ?? '',
            total_price: item.total_price ?? '',
            currency: item.currency || 'USD',
          }))
        : [{ ...EMPTY_LINE }]
    )
    setEditingLines(true)
  }

  const saveLines = () => {
    const items = lineForm.map((row) => ({
      description: row.description || null,
      quantity: row.quantity !== '' ? Number(row.quantity) : null,
      unit_price: row.unit_price !== '' ? Number(row.unit_price) : null,
      total_price: row.total_price !== '' ? Number(row.total_price) : null,
      currency: row.currency || 'USD',
    }))
    lineMutation.mutate(items)
  }

  return (
    <Layout>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white text-sm">← Back</button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">
            {extracted_data?.vendor_name || 'Invoice'}
          </h1>
          <p className="text-gray-500 text-xs mt-0.5">
            {extracted_data?.invoice_number && `#${extracted_data.invoice_number} · `}
            {invoice.category} · {new Date(invoice.upload_date).toLocaleDateString()}
            {invoice.tags?.length > 0 && ` · ${invoice.tags.join(', ')}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isExtracting && <span className="text-blue-400 text-xs animate-pulse">Extracting...</span>}
          <span className={`text-xs px-2 py-1 rounded border ${
            invoice.status === 'approved' ? 'bg-green-900/40 text-green-400 border-green-700'
            : invoice.status === 'rejected' ? 'bg-red-900/40 text-red-400 border-red-700'
            : 'bg-yellow-900/40 text-yellow-400 border-yellow-700'
          }`}>
            {invoice.status.replace('_', ' ')}
          </span>
          {!isExtracting && invoice.status !== 'approved' && (
            <button
              onClick={() => {
                if (confirm('Re-run AI extraction? Existing extracted data will be replaced.')) {
                  reExtractMutation.mutate()
                }
              }}
              disabled={reExtractMutation.isPending}
              className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 px-2 py-1 rounded"
            >
              Re-extract
            </button>
          )}
          <Link to={`/audit?invoice_id=${id}`} className="text-xs text-gray-400 hover:text-white">Audit →</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="lg:sticky lg:top-4">
          <div className="bg-gray-900 border border-gray-800 rounded overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800 flex justify-between">
              <span className="text-xs text-gray-400 font-medium uppercase">Original Document</span>
              {fileUrl && (
                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400">Open ↗</a>
              )}
            </div>
            {fileLoading ? (
              <div className="min-h-[70vh] flex items-center justify-center text-gray-500 text-sm">Loading document...</div>
            ) : fileError ? (
              <div className="min-h-[70vh] flex items-center justify-center text-red-400 text-sm">Failed to load document</div>
            ) : fileUrl ? (
              invoice.file_type === 'pdf' ? (
                <iframe src={fileUrl} title="Invoice" className="w-full min-h-[70vh] border-0 bg-gray-800" />
              ) : (
                <img src={fileUrl} alt="Invoice" className="w-full object-contain max-h-[70vh]" />
              )
            ) : (
              <div className="min-h-[70vh] flex items-center justify-center text-gray-600 text-sm">
                {isExtracting ? 'Processing...' : 'File not available'}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded">
            <div className="px-4 py-2 border-b border-gray-800 flex justify-between">
              <span className="text-xs text-gray-400 font-medium uppercase">Extracted Data</span>
              {canEdit && !editing && (
                <button onClick={startEdit} className="text-xs text-amber-400 hover:text-amber-300">Edit</button>
              )}
            </div>
            {isExtracting ? (
              <div className="p-4 text-center text-gray-500 text-sm">AI extraction in progress...</div>
            ) : invoice.extraction_status === 'failed' ? (
              <div className="p-4 text-center text-red-400 text-sm">
                Extraction failed: {invoice.extraction_error}
                <button
                  onClick={() => reExtractMutation.mutate()}
                  className="block mx-auto mt-3 text-blue-400 text-xs hover:text-blue-300"
                >
                  Retry extraction
                </button>
              </div>
            ) : extracted_data ? (
              <div className="p-4 space-y-3">
                {editing ? (
                  <div className="space-y-3">
                    {EXTRACTED_FIELDS.map(({ key, label, type }) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-500 mb-1">{label}</label>
                        <input
                          type={type}
                          value={editForm[key] ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-700 text-white px-2 py-1 rounded text-sm"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => editMutation.mutate(editForm)} className="flex-1 bg-amber-500 text-black text-xs py-1.5 rounded font-medium">Save</button>
                      <button onClick={() => setEditing(false)} className="flex-1 bg-gray-800 text-gray-400 text-xs py-1.5 rounded">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {EXTRACTED_FIELDS.map(({ key, label }) => (
                      <div key={key} className="flex justify-between gap-4">
                        <span className="text-xs text-gray-500 shrink-0">{label}</span>
                        <span className="text-sm text-white text-right">{extracted_data[key] ?? '—'}</span>
                      </div>
                    ))}
                    {extracted_data.confidence_score != null && (
                      <div className="pt-2 border-t border-gray-800 flex justify-between">
                        <span className="text-xs text-gray-500">Confidence</span>
                        <span className="text-xs text-gray-400">{(extracted_data.confidence_score * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">No extraction data</div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded">
            <div className="px-4 py-2 border-b border-gray-800 flex justify-between">
              <span className="text-xs text-gray-400 font-medium uppercase">Line Items</span>
              {canEdit && !editingLines && (
                <button onClick={startLineEdit} className="text-xs text-amber-400 hover:text-amber-300">Edit</button>
              )}
            </div>
            <div className="p-4">
              {editingLines ? (
                <div className="space-y-3">
                  {lineForm.map((row, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2 border-b border-gray-800 pb-3">
                      <input placeholder="Description" value={row.description}
                        onChange={(e) => { const n = [...lineForm]; n[i].description = e.target.value; setLineForm(n) }}
                        className="col-span-2 bg-gray-800 border border-gray-700 text-white px-2 py-1 rounded text-sm" />
                      <input placeholder="Qty" type="number" value={row.quantity}
                        onChange={(e) => { const n = [...lineForm]; n[i].quantity = e.target.value; setLineForm(n) }}
                        className="bg-gray-800 border border-gray-700 text-white px-2 py-1 rounded text-sm" />
                      <input placeholder="Unit price" type="number" value={row.unit_price}
                        onChange={(e) => { const n = [...lineForm]; n[i].unit_price = e.target.value; setLineForm(n) }}
                        className="bg-gray-800 border border-gray-700 text-white px-2 py-1 rounded text-sm" />
                      <input placeholder="Total" type="number" value={row.total_price}
                        onChange={(e) => { const n = [...lineForm]; n[i].total_price = e.target.value; setLineForm(n) }}
                        className="bg-gray-800 border border-gray-700 text-white px-2 py-1 rounded text-sm" />
                    </div>
                  ))}
                  <button type="button" onClick={() => setLineForm([...lineForm, { ...EMPTY_LINE }])}
                    className="text-xs text-gray-400 hover:text-white">+ Add line</button>
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveLines} className="flex-1 bg-amber-500 text-black text-xs py-1.5 rounded font-medium">Save lines</button>
                    <button onClick={() => setEditingLines(false)} className="flex-1 bg-gray-800 text-gray-400 text-xs py-1.5 rounded">Cancel</button>
                  </div>
                </div>
              ) : line_items?.length > 0 ? (
                <div className="space-y-2">
                  {line_items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm gap-4">
                      <span className="text-gray-300">{item.description || '—'}</span>
                      <span className="text-white shrink-0">{item.currency} {item.total_price}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center">No line items</p>
              )}
            </div>
          </div>

          {canApprove && invoice.status === 'pending_review' && invoice.extraction_status === 'completed' && (
            <div className="flex gap-2">
              <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm py-2 rounded font-medium disabled:opacity-50">Approve</button>
              <button onClick={() => setShowReject(true)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded font-medium">Reject</button>
            </div>
          )}

          {showReject && (
            <div className="bg-gray-900 border border-gray-800 rounded p-4 space-y-3">
              <label className="block text-sm text-gray-400">Reason for rejection</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded text-sm resize-none" rows={3} />
              <div className="flex gap-2">
                <button onClick={() => rejectMutation.mutate()} className="flex-1 bg-red-700 text-white text-sm py-1.5 rounded">Confirm Reject</button>
                <button onClick={() => setShowReject(false)} className="flex-1 bg-gray-800 text-gray-400 text-sm py-1.5 rounded">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
