import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getVendor } from '../services/api'
import Layout from '../components/Layout'

export default function VendorDetail() {
  const { id } = useParams()

  const { data, isLoading, error } = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => getVendor(id),
    select: (res) => res.data,
  })

  if (isLoading) return <Layout><div className="text-gray-400 text-sm py-8 text-center">Loading...</div></Layout>
  if (error) return <Layout><div className="text-red-400 text-sm py-8 text-center">Vendor not found</div></Layout>

  const { vendor, recent_invoices } = data

  return (
    <Layout>
      <Link to="/vendors" className="text-gray-400 hover:text-white text-sm mb-4 inline-block">← Vendors</Link>

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">{vendor.vendor_name}</h1>
          {vendor.is_recurring_vendor && (
            <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-700 px-2 py-0.5 rounded">recurring</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 max-w-lg">
          <div className="bg-gray-900 border border-gray-800 rounded p-3">
            <p className="text-gray-500 text-xs">Total spend</p>
            <p className="text-white font-bold">{Number(vendor.total_spend).toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-3">
            <p className="text-gray-500 text-xs">Invoices</p>
            <p className="text-white font-bold">{vendor.total_invoices}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-3">
            <p className="text-gray-500 text-xs">Average</p>
            <p className="text-white font-bold">
              {vendor.average_invoice ? Number(vendor.average_invoice).toLocaleString() : '—'}
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Recent invoices</h2>
      <div className="space-y-2">
        {recent_invoices?.map((inv) => (
          <Link
            key={inv.id}
            to={`/invoices/${inv.id}`}
            className="block bg-gray-900 border border-gray-800 hover:border-gray-600 rounded p-3 transition-colors"
          >
            <div className="flex justify-between">
              <span className="text-white text-sm">
                {inv.invoice_number ? `#${inv.invoice_number}` : 'Invoice'}
              </span>
              <span className="text-gray-400 text-sm capitalize">{inv.status.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-500 text-xs">{new Date(inv.upload_date).toLocaleDateString()}</span>
              {inv.total_amount != null && (
                <span className="text-white text-sm">{inv.currency} {Number(inv.total_amount).toLocaleString()}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  )
}
