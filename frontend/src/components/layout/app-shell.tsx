import { Link, useNavigate } from "@tanstack/react-router"
import {
  ClapperboardIcon,
  FilmIcon,
  LogOutIcon,
  MailIcon,
  MenuIcon,
  Music2Icon,
  ShieldIcon,
  UsersIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"

import { LiveIndicator } from "@/components/layout/live-indicator"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useCan, useCanAny, ADMIN_SCOPES } from "@/lib/auth/use-can"
import { useLogout, useMe } from "@/lib/queries/auth"

interface NavItemProps {
  to:
    | "/movies"
    | "/songs"
    | "/admin/invitations"
    | "/admin/users"
    | "/admin/roles"
  icon: ReactNode
  children: ReactNode
  onNavigate?: () => void
}

function NavItem({ to, icon, children, onNavigate }: NavItemProps) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="group/nav relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-foreground/60 data-[status=active]:[&>svg]:text-sidebar-primary"
      activeOptions={{ exact: false }}
    >
      <span
        aria-hidden
        className="absolute top-2 bottom-2 -left-2 w-0.5 rounded-full bg-sidebar-primary opacity-0 group-data-[status=active]/nav:opacity-100"
      />
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  )
}

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/movies"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-md px-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ClapperboardIcon className="size-5 text-sidebar-primary" aria-hidden />
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight">
          ACME BROS PICTURES
        </span>
        <span className="block text-xs text-muted-foreground">
          Licencias musicales
        </span>
      </span>
    </Link>
  )
}

/** Brand, sections and the session footer; the sidebar on wide screens, a sheet on narrow ones. */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const me = useMe()
  const navigate = useNavigate()
  const logout = useLogout()
  const showAdmin = useCanAny(ADMIN_SCOPES)
  const canInvitations = useCan("invitations:read")
  const canUsers = useCan("users:read")
  const canRoles = useCan("roles:read")

  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => void navigate({ to: "/login", replace: true }),
    })
  }

  return (
    <>
      <Brand onNavigate={onNavigate} />

      <nav aria-label="Secciones" className="mt-7 flex flex-1 flex-col gap-6">
        <ul className="flex flex-col gap-0.5">
          <li>
            <NavItem to="/movies" icon={<FilmIcon />} onNavigate={onNavigate}>
              Películas
            </NavItem>
          </li>
          <li>
            <NavItem to="/songs" icon={<Music2Icon />} onNavigate={onNavigate}>
              Canciones
            </NavItem>
          </li>
        </ul>
        {showAdmin ? (
          <div>
            <p className="mb-1.5 px-2.5 text-xs text-muted-foreground">
              Administración
            </p>
            <ul className="flex flex-col gap-0.5">
              {canInvitations ? (
                <li>
                  <NavItem
                    to="/admin/invitations"
                    icon={<MailIcon />}
                    onNavigate={onNavigate}
                  >
                    Invitaciones
                  </NavItem>
                </li>
              ) : null}
              {canUsers ? (
                <li>
                  <NavItem
                    to="/admin/users"
                    icon={<UsersIcon />}
                    onNavigate={onNavigate}
                  >
                    Usuarios
                  </NavItem>
                </li>
              ) : null}
              {canRoles ? (
                <li>
                  <NavItem
                    to="/admin/roles"
                    icon={<ShieldIcon />}
                    onNavigate={onNavigate}
                  >
                    Roles
                  </NavItem>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </nav>

      <div className="flex flex-col gap-3 border-t border-sidebar-border pt-4">
        <LiveIndicator className="px-1" />
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium" title={me.user.email}>
              {me.user.name}
            </p>
            <p
              className="truncate text-xs text-muted-foreground"
              title={me.tenant.slug}
            >
              {me.tenant.name}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Salir"
                onClick={onLogout}
                disabled={logout.isPending}
              >
                <LogOutIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Salir</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <aside className="sticky top-0 hidden h-svh w-[232px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-3 py-2 lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <LiveIndicator className="px-2" />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir el menú">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[280px] flex-col bg-sidebar px-4 py-5"
            >
              <SheetTitle className="sr-only">Secciones</SheetTitle>
              <SheetDescription className="sr-only">
                Navegación y sesión
              </SheetDescription>
              <SidebarContent onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  )
}
