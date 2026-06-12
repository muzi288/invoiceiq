import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../services/api'
import useAuthStore from '../store/authStore'
import Layout from '../components/Layout'

export default function Settings() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({})
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getSettings(),
    select: (res) => res.data,
  })

  useEffect(() => {
    if (data) {
      setForm({
        default_currency: data.default_currency || 'USD',
        timezone: data.timezone || 'UTC',
        logo_url: data.logo_url || '',
        notify_on_upload: data.notify_on_upload ?? true,
        notify_on_failure: data.notify_on_failure ?? true,
      })
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: (payload) => updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['settings'])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  if (isLoading) {
    return <Layout><div className="text-gray-400 text-sm py-8 text-center">Loading...</div></Layout>
  }

  const isOwner = user?.role === 'owner'

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {!isOwner && (
        <p className="text-gray-500 text-sm mb-4">View only — contact your owner to change settings.</p>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); if (isOwner) mutation.mutate(form) }}
        className="max-w-lg space-y-4"
      >
        <div>
          <label className="block text-sm text-gray-400 mb-1">Default currency</label>
          <input
            value={form.default_currency || ''}
            onChange={(e) => setForm({ ...form, default_currency: e.target.value })}
            disabled={!isOwner}
            className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Timezone</label>
          <input
            value={form.timezone || ''}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            disabled={!isOwner}
            className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Logo URL</label>
          <input
            value={form.logo_url || ''}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            disabled={!isOwner}
            placeholder="https://..."
            className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm disabled:opacity-60"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={form.notify_on_upload ?? false}
            onChange={(e) => setForm({ ...form, notify_on_upload: e.target.checked })}
            disabled={!isOwner}
          />
          Notify on upload complete
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={form.notify_on_failure ?? false}
            onChange={(e) => setForm({ ...form, notify_on_failure: e.target.checked })}
            disabled={!isOwner}
          />
          Notify on extraction failure
        </label>

        {isOwner && (
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 px-6 rounded text-sm disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save settings'}
          </button>
        )}
        {saved && <span className="text-green-400 text-sm ml-3">Saved!</span>}
      </form>
    </Layout>
  )
}
