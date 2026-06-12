import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getVendors } from '../services/api'
import Layout from '../components/Layout'

export default function Vendors() {
  const { data, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => getVendors(),
    select: (res) => res.data,
  })

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Vendors</h1>
        <p className="text-gray-400 text-sm mt-1">
          {data?.total ?? 0} vendors tracked
          {data?.tenant_currency && (
            <span> · amounts in {data.tenant_currency}</span>
          )}
        </p>
      </div>

      {isLoading && <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>}

      <div className="space-y-2">
        {data?.items?.map((vendor) => (
          <Link
            key={vendor.id}
            to={`/vendors/${vendor.id}`}
            className="block bg-gray-900 border border-gray-800 hover:border-gray-600 rounded p-4 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium">{vendor.vendor_name}</p>
                  {vendor.is_recurring_vendor && (
                    <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-700 px-2 py-0.5 rounded">
                      recurring
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {vendor.total_invoices} invoice{vendor.total_invoices !== 1 ? 's' : ''}
                  {vendor.last_invoice_date && ` · last ${new Date(vendor.last_invoice_date).toLocaleDateString()}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white font-medium">
                  {vendor.display_currency} {Number(vendor.display_total_spend ?? 0).toLocaleString()}
                </p>
                <p className="text-gray-500 text-xs">
                  avg {vendor.display_average_invoice != null
                    ? `${vendor.display_currency} ${Number(vendor.display_average_invoice).toLocaleString()}`
                    : '—'}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {data?.items?.length === 0 && !isLoading && (
        <div className="text-center py-16 text-gray-500 text-sm">
          No vendors yet — they appear after invoice extraction
        </div>
      )}
    </Layout>
  )
}
