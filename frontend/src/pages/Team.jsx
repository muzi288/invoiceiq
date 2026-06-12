import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, inviteUser, updateUserPermissions, deactivateUser } from '../services/api'
import Layout from '../components/Layout'

export default function Team() {
  const queryClient = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'staff' })
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
    select: (res) => res.data,
  })

  const inviteMutation = useMutation({
    mutationFn: (payload) => inviteUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['users'])
      setShowInvite(false)
      setInviteForm({ email: '', full_name: '', role: 'staff' })
      setError('')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Invite failed'),
  })

  const permMutation = useMutation({
    mutationFn: ({ userId, perms }) => updateUserPermissions(userId, perms),
    onSuccess: () => queryClient.invalidateQueries(['users']),
  })

  const deactivateMutation = useMutation({
    mutationFn: (userId) => deactivateUser(userId),
    onSuccess: () => queryClient.invalidateQueries(['users']),
  })

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-gray-400 text-sm mt-1">Manage staff and permissions</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 px-4 rounded text-sm"
        >
          Invite member
        </button>
      </div>

      {showInvite && (
        <div className="bg-gray-900 border border-gray-800 rounded p-4 mb-6 max-w-md space-y-3">
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <input
            placeholder="Email"
            type="email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded text-sm"
          />
          <input
            placeholder="Full name"
            value={inviteForm.full_name}
            onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded text-sm"
          />
          <p className="text-gray-500 text-xs">Temporary password: ChangeMe123!</p>
          <div className="flex gap-2">
            <button
              onClick={() => inviteMutation.mutate(inviteForm)}
              disabled={inviteMutation.isPending}
              className="flex-1 bg-amber-500 text-black text-sm py-2 rounded font-medium"
            >
              Send invite
            </button>
            <button onClick={() => setShowInvite(false)} className="flex-1 bg-gray-800 text-gray-400 text-sm py-2 rounded">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>}

      <div className="space-y-2">
        {data?.items?.map((member) => (
          <div key={member.id} className="bg-gray-900 border border-gray-800 rounded p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-white font-medium">{member.full_name}</p>
                <p className="text-gray-500 text-sm">{member.email}</p>
                <span className="text-xs text-amber-400 capitalize mt-1 inline-block">{member.role}</span>
              </div>
              {member.role === 'staff' && (
                <div className="flex flex-col gap-2 items-end">
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input
                      type="checkbox"
                      checked={member.can_approve}
                      onChange={(e) => permMutation.mutate({
                        userId: member.id,
                        perms: { can_approve: e.target.checked },
                      })}
                    />
                    Can approve
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input
                      type="checkbox"
                      checked={member.can_export}
                      onChange={(e) => permMutation.mutate({
                        userId: member.id,
                        perms: { can_export: e.target.checked },
                      })}
                    />
                    Can export
                  </label>
                  <button
                    onClick={() => {
                      if (confirm(`Deactivate ${member.full_name}?`)) {
                        deactivateMutation.mutate(member.id)
                      }
                    }}
                    className="text-red-400 text-xs hover:text-red-300"
                  >
                    Deactivate
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
