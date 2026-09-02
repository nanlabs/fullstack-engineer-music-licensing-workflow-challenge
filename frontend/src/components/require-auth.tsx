import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { getApiMode } from '@/api'

/** Wraps protected routes — redirects to /login when unauthenticated.
 *  In mock mode auth is bypassed (no real backend). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Mock mode: always allow
  if (getApiMode() === 'mock') return <>{children}</>

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
