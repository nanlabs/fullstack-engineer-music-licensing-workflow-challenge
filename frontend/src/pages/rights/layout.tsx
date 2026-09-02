import { Outlet, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/app-layout'
import { useRightsPersona, RealPersonaProvider } from '@/lib/rights-persona'
import { getApiMode } from '@/api'
import { Inbox, LayoutDashboard, LibraryBig, Users } from 'lucide-react'

function RightsLayoutInner() {
  const location = useLocation()
  const persona = useRightsPersona()

  const items = [
    { label: 'Dashboard', href: '/rights', icon: <LayoutDashboard className="size-4" /> },
    { label: 'Catalog', href: '/rights/catalog', icon: <LibraryBig className="size-4" /> },
    { label: 'Incoming requests', href: '/rights/inbox', icon: <Inbox className="size-4" /> },
    ...(persona.kind === 'label'
      ? [{ label: 'Label members', href: '/rights/members', icon: <Users className="size-4" /> }]
      : []),
  ]
  const activeHref = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find(item => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`))
    ?.href ?? '/rights'

  return (
    <AppLayout
      navGroups={[{ label: persona.kind === 'label' ? 'Label workspace' : 'Artist workspace', items }]}
      activeHref={activeHref}
      userName={persona.user.name}
      userRole={persona.platformRole}
      workspaceHref="/rights"
      workspaceName={persona.labelName ?? persona.user.name}
      workspaceDescription={persona.kind === 'label'
        ? `${persona.labelRole === 'OWNER' ? 'Owner' : persona.labelRole === 'REP' ? 'Representative' : 'Artist'} workspace`
        : 'Independent artist'}
      headerLabel={persona.title}
    >
      <Outlet />
    </AppLayout>
  )
}

export function RightsLayout() {
  if (getApiMode() === 'real') {
    return (
      <RealPersonaProvider>
        <RightsLayoutInner />
      </RealPersonaProvider>
    )
  }
  return <RightsLayoutInner />
}
