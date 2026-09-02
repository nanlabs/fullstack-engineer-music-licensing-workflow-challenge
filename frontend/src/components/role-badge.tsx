import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MovieRole, LabelRole, UsageType } from '@/types'

// ─── Movie roles ───
const movieRoleConfig: Record<MovieRole, { label: string; className: string }> = {
  OWNER: { label: 'Owner', className: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
  SUPERVISOR: { label: 'Supervisor', className: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' },
  EDITOR: { label: 'Editor', className: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
  VIEWER: { label: 'Viewer', className: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
}

interface MovieRoleBadgeProps {
  role: MovieRole
  className?: string
}

export function MovieRoleBadge({ role, className }: MovieRoleBadgeProps) {
  const c = movieRoleConfig[role]
  return (
    <Badge className={cn('text-[11px]', c.className, className)}>
      {c.label}
    </Badge>
  )
}

// ─── Label roles ───
const labelRoleConfig: Record<LabelRole, { label: string; className: string }> = {
  OWNER: { label: 'Owner', className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  REP: { label: 'Rep', className: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  ARTIST: { label: 'Artist', className: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
}

interface LabelRoleBadgeProps {
  role: LabelRole
  className?: string
}

export function LabelRoleBadge({ role, className }: LabelRoleBadgeProps) {
  const c = labelRoleConfig[role]
  return (
    <Badge className={cn('text-[11px]', c.className, className)}>
      {c.label}
    </Badge>
  )
}

// ─── Usage type ───
interface UsageBadgeProps {
  usage: UsageType
  className?: string
}

export function UsageBadge({ usage, className }: UsageBadgeProps) {
  const label = usage.charAt(0) + usage.slice(1).toLowerCase()
  return (
    <Badge variant="outline" className={cn('text-[11px]', className)}>
      {label}
    </Badge>
  )
}

// ─── Negotiation side ───
interface SideBadgeProps {
  side: 'MOVIE_TEAM' | 'RIGHTS_HOLDER'
  className?: string
}

export function SideBadge({ side, className }: SideBadgeProps) {
  const label = side === 'MOVIE_TEAM' ? 'Movie Team' : 'Rights Holder'
  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', className)}>
      {label}
    </Badge>
  )
}
