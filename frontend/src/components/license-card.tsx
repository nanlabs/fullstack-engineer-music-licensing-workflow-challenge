import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Clock3 } from 'lucide-react'
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import type { LicenseRequest, LicenseOffer, LicenseStatus } from '@/types'

interface LicenseCardProps {
  license: LicenseRequest
  latestOffer?: LicenseOffer | null
  offerCount?: number
  songTitle?: string
  sceneTitle?: string
  movieTitle?: string
  nextAction?: string
  resolvedByName?: string
  onClick?: () => void
  className?: string
}

export function LicenseCard({
  license,
  latestOffer,
  offerCount,
  songTitle,
  sceneTitle,
  movieTitle,
  nextAction,
  resolvedByName,
  onClick,
  className,
}: LicenseCardProps) {
  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      onClick={onClick}
      onKeyDown={event => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) onClick()
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="font-mono text-[12px] text-muted-foreground">#{license.id.slice(0, 8)}</CardTitle>
            {songTitle && <p className="mt-1 truncate text-sm font-semibold text-foreground">{songTitle}</p>}
          </div>
          <StatusBadge status={license.status as LicenseStatus} />
        </div>
        {(movieTitle || sceneTitle) && (
          <CardDescription className="text-[12px] leading-relaxed">
            {[movieTitle, sceneTitle].filter(Boolean).join(' · ')}
          </CardDescription>
        )}
      </CardHeader>

      {latestOffer && (
        <CardContent className="pb-3 space-y-1.5">
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">Fee</span>
            <span className="font-medium">
              {formatCurrency(latestOffer.license_fee, latestOffer.currency)}
            </span>
          </div>
          {latestOffer.territory && (
            <div className="flex justify-between text-[13px]">
              <span className="text-muted-foreground">Territory</span>
              <span>{latestOffer.territory}</span>
            </div>
          )}
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">Exclusive</span>
            <span>{latestOffer.exclusive ? 'Yes' : 'No'}</span>
          </div>
        </CardContent>
      )}

      <CardFooter className="justify-between border-t border-border/60 pt-3">
        <div className="min-w-0 space-y-1">
          {nextAction && <p className="truncate text-[12px] font-medium text-foreground">{nextAction}</p>}
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock3 className="size-3" /> {formatRelativeTime(license.updated_at)}
            {offerCount != null ? ` · ${offerCount} offer${offerCount !== 1 ? 's' : ''}` : ''}
            {resolvedByName ? ` · Resolved by ${resolvedByName}` : ''}
          </span>
        </div>
        {onClick && <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />}
      </CardFooter>
    </Card>
  )
}
