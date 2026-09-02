import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { PlatformRole } from '@/types'

const roleColors: Record<PlatformRole, string> = {
  Admin: 'bg-red-600',
  Producer: 'bg-blue-600',
  Artist: 'bg-violet-600',
  'Label Manager': 'bg-amber-600',
  Viewer: 'bg-gray-600',
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizeMap: Record<Size, { container: string; text: string }> = {
  xs: { container: 'h-6 w-6', text: 'text-[9px]' },
  sm: { container: 'h-8 w-8', text: 'text-[10px]' },
  md: { container: 'h-9 w-9', text: 'text-xs' },
  lg: { container: 'h-10 w-10', text: 'text-xs' },
  xl: { container: 'h-12 w-12', text: 'text-sm' },
}

interface UserAvatarProps {
  name: string
  role?: PlatformRole
  size?: Size
  className?: string
  color?: string
}

export function UserAvatar({ name, role, size = 'md', className, color }: UserAvatarProps) {
  const bg = color ?? (role ? roleColors[role] : 'bg-primary')
  const s = sizeMap[size]

  return (
    <Avatar className={cn(s.container, className)}>
      <AvatarFallback className={cn(bg, 'text-white font-medium', s.text)}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

interface UserAvatarWithInfoProps extends UserAvatarProps {
  subtitle?: string
}

export function UserAvatarWithInfo({ subtitle, role, ...props }: UserAvatarWithInfoProps) {
  return (
    <div className="flex items-center gap-3">
      <UserAvatar role={role} {...props} />
      <div>
        <p className="text-[13px] font-medium">{props.name}</p>
        {(subtitle || role) && (
          <p className="text-[11px] text-muted-foreground">{subtitle ?? role}</p>
        )}
      </div>
    </div>
  )
}
