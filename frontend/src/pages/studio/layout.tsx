import { Outlet, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/app-layout'
import { useAuth } from '@/lib/auth'
import { LayoutDashboard, Clapperboard, FileSignature } from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/studio', icon: <LayoutDashboard className="size-4" /> },
      { label: 'Movies', href: '/studio/movies', icon: <Clapperboard className="size-4" /> },
      { label: 'Licenses', href: '/studio/licenses', icon: <FileSignature className="size-4" /> },
    ],
  },
]

const NAV_ITEMS = NAV_GROUPS.flatMap(group => group.items)

export function StudioLayout() {
  const location = useLocation()
  const { user } = useAuth()

  // Highlight the closest matching top-level section (e.g. /studio/movies/123 -> /studio/movies)
  const activeHref = [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find(item => location.pathname === item.href || location.pathname.startsWith(item.href + '/'))
    ?.href ?? '/studio'

  return (
    <AppLayout
      navGroups={NAV_GROUPS}
      activeHref={activeHref}
      userName={user?.name ?? 'User'}
      userRole="Producer"
    >
      <Outlet />
    </AppLayout>
  )
}
