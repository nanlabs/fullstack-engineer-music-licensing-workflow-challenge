import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/status-badge'
import { SideBadge } from '@/components/role-badge'
import { cn } from '@/lib/utils'
import type { LicenseOffer, LicenseStatus, NegotiationSide } from '@/types'

function formatCurrency(amount: number | null, currency: string | null): string {
  if (amount == null) return '--'
  const cur = currency ?? 'USD'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(amount)
}

interface TimelineOffer extends LicenseOffer {
  proposer_name?: string
}

interface NegotiationTimelineProps {
  status: LicenseStatus
  offers: TimelineOffer[]
  songTitle?: string
  sceneTitle?: string
  movieTitle?: string
  resolvedByName?: string
  className?: string
}

const sideColor: Record<NegotiationSide, string> = {
  MOVIE_TEAM: 'bg-blue-500',
  RIGHTS_HOLDER: 'bg-amber-500',
}

export function NegotiationTimeline({
  status,
  offers,
  songTitle,
  sceneTitle,
  movieTitle,
  resolvedByName,
  className,
}: NegotiationTimelineProps) {
  const sorted = [...offers].sort((a, b) => a.offer_number - b.offer_number)
  const isResolved = status === 'APPROVED' || status === 'REJECTED' || status === 'CANCELLED'

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <CardTitle className="text-sm truncate">
              {songTitle ?? 'Song'} → {sceneTitle ?? 'Scene'}
            </CardTitle>
            {movieTitle && (
              <CardDescription className="text-[13px]">{movieTitle}</CardDescription>
            )}
          </div>
          <StatusBadge status={status} className="shrink-0 ml-2" />
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-0">
          {sorted.map((offer, i) => {
            const terms = [
              offer.territory,
              offer.exclusive ? 'Exclusive' : 'Non-exclusive',
            ].filter(Boolean).join(' · ')

            return (
              <div key={offer.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0',
                    sideColor[offer.side],
                  )}>
                    {offer.offer_number}
                  </div>
                  {(i < sorted.length - 1 || isResolved) && (
                    <div className="w-px flex-1 bg-border min-h-[24px]" />
                  )}
                </div>
                <div className="pb-5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">
                      {offer.proposer_name ?? `User ${offer.proposed_by.slice(0, 8)}`}
                    </span>
                    <SideBadge side={offer.side} />
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-lg font-semibold tabular-nums">
                      {formatCurrency(offer.license_fee, offer.currency)}
                    </span>
                    {terms && (
                      <span className="text-[11px] text-muted-foreground">{terms}</span>
                    )}
                  </div>
                  {offer.notes && (
                    <p className="text-[12px] text-muted-foreground mt-0.5">{offer.notes}</p>
                  )}
                </div>
              </div>
            )
          })}

          {isResolved && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0',
                  status === 'APPROVED' ? 'bg-emerald-500' : status === 'REJECTED' ? 'bg-red-500' : 'bg-gray-500',
                )}>
                  {status === 'APPROVED' ? '\u2713' : status === 'REJECTED' ? '\u2717' : '\u2014'}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium">
                    {resolvedByName ?? 'System'}
                  </span>
                  <Badge className={cn(
                    'text-[10px] px-1.5 py-0',
                    status === 'APPROVED' && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
                    status === 'REJECTED' && 'bg-red-500/15 text-red-400 border-red-500/20',
                    status === 'CANCELLED' && 'bg-gray-500/15 text-gray-400 border-gray-500/20',
                  )}>
                    {status === 'APPROVED' ? 'Accepted' : status === 'REJECTED' ? 'Rejected' : 'Cancelled'}
                  </Badge>
                </div>
                {sorted.length > 0 && status === 'APPROVED' && (
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Agreed to {formatCurrency(sorted[sorted.length - 1].license_fee, sorted[sorted.length - 1].currency)}
                    {sorted[sorted.length - 1].territory ? ` · ${sorted[sorted.length - 1].territory}` : ''}
                    {sorted[sorted.length - 1].exclusive ? ' · Exclusive' : ' · Non-exclusive'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
