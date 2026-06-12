import { Navigate, useLocation } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function PrivateRoute({ children }) {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  if (!token) return <Navigate to="/login" replace />

  if (user?.must_change_password && !location.pathname.startsWith('/profile')) {
    return <Navigate to="/profile?setup=1" replace />
  }

  const needsOnboarding =
    user?.role === 'owner'
    && user?.onboarding_completed === false
    && !location.pathname.startsWith('/onboarding')

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
