import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getInvoice, getInvoiceFile, getAuditLog, approveInvoice, rejectInvoice,
  updateExtracted, updateLineItems, reExtractInvoice, updateInvoice, deleteInvoice,
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

const CATEGORIES = [
  'uncategorised', 'inventory', 'utilities', 'equipment',
  'payroll', 'travel', 'office', 'other',
]

const PAYMENT_STATUSES = ['unpaid', 'paid', 'partial', 'overdue']

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
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaForm, setMetaForm] = useState({})
  const [showAudit, setShowAudit] = useState(false)

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

  const metaMutation = useMutation({
    mutationFn: (payload) => updateInvoice(id, payload),
    onSuccess: () => { invalidate(); setEditingMeta(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteInvoice(id),
    onSuccess: () => navigate('/dashboard'),
  })

  const { data: auditData } = useQuery({
    queryKey: ['audit', id, 'inline'],
    queryFn: () => getAuditLog({ invoice_id: id, limit: 20 }),
    select: (res) => res.data,
    enabled: showAudit && !!id,
  })

  if (isLoading) return <Layout><div className="text-gray-400 text-sm py-8 text-center">Loading...</div></Layout>
  if (error) return <Layout><div className="text-red-400 text-sm py-8 text-center">Failed to load invoice</div></Layout>

  const { invoice, extracted_data, line_items } = data
  const isOwner = user?.role === 'owner'
  const canApprove = isOwner || user?.can_approve
  const isExtracting = !['completed', 'failed'].includes(invoice.extraction_status)
  const canEdit = invoice.status === 'pending_review' && extracted_data

  const lineItemsTotal = line_items?.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0) ?? 0
  const headerTotal = Number(extracted_data?.total_amount) || 0
  const totalsMismatch = extracted_data?.total_amount != null && line_items?.length > 0
    && Math.abs(lineItemsTotal - headerTotal) > 0.01

  const startMetaEdit = () => {
    setMetaForm({
      category: invoice.category || 'uncategorised',
      tags: (invoice.tags || []).join(', '),
      payment_status: invoice.payment_status || 'unpaid',
      payment_date: invoice.payment_date || '',
      payment_ref: invoice.payment_ref || '',
    })
    setEditingMeta(true)
  }

  const saveMeta = () => {
    metaMutation.mutate({
      category: metaForm.category,
      tags: metaForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      payment_status: metaForm.payment_status,
      payment_date: metaForm.payment_date || null,
      payment_ref: metaForm.payment_ref || null,
    })
  }

  const handleReExtract = () => {
    const edited = extracted_data?.edited_at
    const msg = edited
      ? 'This invoice was manually edited. Re-extraction will replace all extracted data and line items. Continue?'
      : 'Re-run AI extraction? Existing extracted data will be replaced.'
    if (confirm(msg)) reExtractMutation.mutate()
  }

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
              onClick={handleReExtract}
              disabled={reExtractMutation.isPending}
              className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 px-2 py-1 rounded"
            >
              Re-extract
            </button>
          )}
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => setShowAudit((v) => !v)}
                className="text-xs text-gray-400 hover:text-white"
              >
                {showAudit ? 'Hide history' : 'History'}
              </button>
              <Link
                to={`/audit?invoice_id=${id}&invoice_label=${encodeURIComponent(extracted_data?.vendor_name || 'Invoice')}`}
                className="text-xs text-gray-500 hover:text-white"
              >
                Full audit →
              </Link>
            </>
          )}
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
              <span className="text-xs text-gray-400 font-medium uppercase">Invoice Details</span>
              {!editingMeta && (
                <button onClick={startMetaEdit} className="text-xs text-amber-400 hover:text-amber-300">Edit</button>
              )}
            </div>
            <div className="p-4 space-y-3">
              {editingMeta ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Category</label>
                    <select value={metaForm.category} onChange={(e) => setMetaForm({ ...metaForm, category: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white px-2 py-1 rounded text-sm">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tags (comma separated)</label>
                    <input value={metaForm.tags} onChange={(e) => setMetaForm({ ...metaForm, tags: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white px-2 py-1 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Payment status</label>
                    <select value={metaForm.payment_status} onChange={(e) => setMetaForm({ ...metaForm, payment_status: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white px-2 py-1 rounded text-sm">
                      {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Payment date</label>
                    <input type="date" value={metaForm.payment_date} onChange={(e) => setMetaForm({ ...metaForm, payment_date: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white px-2 py-1 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Payment reference</label>
                    <input value={metaForm.payment_ref} onChange={(e) => setMetaForm({ ...metaForm, payment_ref: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white px-2 py-1 rounded text-sm" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveMeta} className="flex-1 bg-amber-500 text-black text-xs py-1.5 rounded font-medium">Save</button>
                    <button onClick={() => setEditingMeta(false)} className="flex-1 bg-gray-800 text-gray-400 text-xs py-1.5 rounded">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  {[
                    ['Category', invoice.category],
                    ['Tags', invoice.tags?.length ? invoice.tags.join(', ') : '—'],
                    ['Payment', invoice.payment_status || 'unpaid'],
                    ['Paid on', invoice.payment_date || '—'],
                    ['Payment ref', invoice.payment_ref || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="text-sm text-white text-right capitalize">{value}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {showAudit && (
            <div className="bg-gray-900 border border-gray-800 rounded">
              <div className="px-4 py-2 border-b border-gray-800">
                <span className="text-xs text-gray-400 font-medium uppercase">Activity History</span>
              </div>
              <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                {auditData?.items?.length ? auditData.items.map((log) => (
                  <div key={log.id} className="text-xs border-b border-gray-800/50 pb-2">
                    <div className="flex justify-between gap-2">
                      <span className="text-amber-400 capitalize">{log.action.replace(/_/g, ' ')}</span>
                      <span className="text-gray-600">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-gray-500 mt-0.5">{log.user_name} ({log.user_role})</p>
                    {log.extra_data && Object.keys(log.extra_data).length > 0 && (
                      <p className="text-gray-600 mt-0.5 truncate">{JSON.stringify(log.extra_data)}</p>
                    )}
                  </div>
                )) : (
                  <p className="text-gray-500 text-sm text-center">No activity yet</p>
                )}
              </div>
            </div>
          )}

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
                        <span className={`text-xs ${
                          extracted_data.confidence_score < 0.8 ? 'text-amber-400' : 'text-gray-400'
                        }`}>
                          {(extracted_data.confidence_score * 100).toFixed(0)}%
                          {extracted_data.confidence_score < 0.8 && ' — review suggested'}
                        </span>
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
                  {totalsMismatch && (
                    <p className="text-amber-400 text-xs mb-2">
                      Line items total ({lineItemsTotal.toFixed(2)}) does not match invoice total ({headerTotal.toFixed(2)})
                    </p>
                  )}
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

          {isOwner && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Delete this invoice? This cannot be undone.')) deleteMutation.mutate()
              }}
              disabled={deleteMutation.isPending}
              className="w-full text-red-500 hover:text-red-400 text-xs py-2 border border-red-900 rounded"
            >
              Delete invoice
            </button>
          )}
        </div>
      </div>
    </Layout>
  )
}
