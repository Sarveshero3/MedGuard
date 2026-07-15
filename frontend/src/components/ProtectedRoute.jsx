import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Skeleton } from './ui/skeleton'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex-grow w-full max-w-[1200px] mx-auto px-6 md:px-16 py-16">
        <Skeleton className="h-12 w-64 mb-6" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
