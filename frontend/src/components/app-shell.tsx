import { useState } from 'react'
import { ChevronsUpDown, LogOut, Menu, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/user-avatar'
import { NotificationBell } from '@/components/notification-bell'
import { useTheme } from '@/components/theme-provider'
import type { PlatformRole } from '@/types'

// ─── Sidebar ───
interface NavItem {
  label: string
  href: string
  icon?: React.ReactNode
  count?: number
}

interface SidebarProps {
  items: NavItem[]
  activeHref: string
  onNavigate: (href: string) => void
  userName?: string
  userRole?: PlatformRole
}

function SidebarItems({ items, activeHref, onNavigate }: Omit<SidebarProps, 'userName' | 'userRole'>) {
  return (
    <ul className="space-y-1">
      {items.map(item => (
        <li key={item.href}>
          <button
            onClick={() => onNavigate(item.href)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeHref === item.href
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
            )}
          >
            <span className="flex items-center gap-2.5">
              {item.icon}
              {item.label}
            </span>
            {item.count !== undefined && (
              <span className="text-[11px] text-muted-foreground tabular-nums">{item.count}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Account menu pinned to the bottom of the sidebar: identity + dev/theme controls. */
function UserMenu({ userName = 'User', userRole }: { userName?: string; userRole?: PlatformRole }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <UserAvatar name={userName} role={userRole} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{userName}</span>
          {userRole && <span className="block truncate text-[11px] text-muted-foreground">{userRole}</span>}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My account</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem closeOnClick={false} onClick={toggleTheme} className="justify-between">
          <span className="flex items-center gap-1.5">
            {theme === 'dark' ? <Moon /> : <Sun />}
            Theme
          </span>
          <span className="text-[11px] text-muted-foreground capitalize">{theme}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppSidebar({ items, activeHref, onNavigate, userName, userRole }: SidebarProps) {
  return (
    <nav className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border sticky top-14 h-[calc(100vh-3.5rem)] py-4 px-3">
      <div className="flex-1 overflow-y-auto">
        <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Studio workspace</p>
        <SidebarItems items={items} activeHref={activeHref} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-border pt-3">
        <UserMenu userName={userName} userRole={userRole} />
      </div>
    </nav>
  )
}

// ─── Header ───
interface AppHeaderProps {
  userName?: string
  userRole?: PlatformRole
  navItems?: NavItem[]
  activeHref?: string
  onNavigate?: (href: string) => void
}

export function AppHeader({ userName = 'User', userRole, navItems = [], activeHref = '', onNavigate }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="border-b border-border bg-background/85 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center justify-between h-14 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {onNavigate && navItems.length > 0 && (
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden -ml-2" aria-label="Open navigation" />}>
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
                <SheetHeader className="border-b p-5">
                  <SheetTitle>Studio workspace</SheetTitle>
                </SheetHeader>
                <nav className="flex-1 overflow-y-auto p-3">
                  <SidebarItems
                    items={navItems}
                    activeHref={activeHref}
                    onNavigate={href => {
                      onNavigate(href)
                      setMobileOpen(false)
                    }}
                  />
                </nav>
                <div className="border-t border-border p-3">
                  <UserMenu userName={userName} userRole={userRole} />
                </div>
              </SheetContent>
            </Sheet>
          )}
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-semibold text-xs">ML</span>
          </div>
          <span className="hidden xs:inline font-semibold text-[15px] tracking-tight">Music Licensing</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <NotificationBell />
          <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggleTheme}>
            {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
          <div className="lg:hidden">
            <Separator orientation="vertical" className="h-4" />
          </div>
          <div className="lg:hidden">
            <UserAvatar name={userName} role={userRole} size="sm" />
          </div>
        </div>
      </div>
    </header>
  )
}

// ─── Shell ───
interface AppShellProps {
  sidebar?: React.ReactNode
  children: React.ReactNode
}

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        {sidebar}
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
