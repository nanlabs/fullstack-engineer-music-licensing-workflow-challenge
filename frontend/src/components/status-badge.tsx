import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { LicenseStatus } from '@/types'

const config: Record<LicenseStatus, { label: string; className: string }> = {
  DRAFT: {
    label: 'Draft',
    className: 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20 hover:bg-muted-foreground/15',
  },
  REQUESTED: {
    label: 'Requested',
    className: 'bg-blue-500/15 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/20',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-gray-500/15 text-gray-400 border-gray-500/20 hover:bg-gray-500/20',
  },
}

interface StatusBadgeProps {
  status: LicenseStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const c = config[status]
  return (
    <Badge className={cn('text-[11px]', c.className, className)}>
      {c.label}
    </Badge>
  )
}
