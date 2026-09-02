import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getApiMode } from '@/api'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/lib/use-async'
import { loadRightsLicenses } from '@/lib/rights-data'
import { useRightsPersona } from '@/lib/rights-persona'
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils'
import { ArrowRight, Inbox, Search } from 'lucide-react'
import type { LicenseStatus } from '@/types'

const FILTERS: Array<{ label: string; value: 'ALL' | 'NEEDS_RESPONSE' | LicenseStatus }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Needs response', value: 'NEEDS_RESPONSE' },
  { label: 'Requested', value: 'REQUESTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

export function RightsInboxPage() {
  const persona = useRightsPersona()
  const { data, loading, error, reload } = useAsync(
    () => loadRightsLicenses(persona),
    [persona.id, persona.labelId, persona.user.id, getApiMode()],
  )
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('NEEDS_RESPONSE')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')

  useEffect(() => api.licenses.subscribeEvents(reload), [reload])

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return [...(data ?? [])]
      .filter(item => filter === 'ALL'
        || (filter === 'NEEDS_RESPONSE'
          ? item.license.status === 'REQUESTED' && item.latestOffer?.side === 'MOVIE_TEAM'
          : item.license.status === filter))
      .filter(item => !normalized || [item.song.title, item.movie?.title, item.scene?.title]
        .some(value => value?.toLowerCase().includes(normalized)))
      .sort((a, b) => {
        const difference = new Date(b.license.updated_at).getTime() - new Date(a.license.updated_at).getTime()
        return sort === 'newest' ? difference : -difference
      })
  }, [data, filter, query, sort])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Incoming requests"
        description={persona.canNegotiate
          ? 'Review and respond to requests targeting your catalog.'
          : 'Track requests connected to your songs. A label owner or rep handles negotiation.'}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
          {FILTERS.map(item => (
            <Button key={item.value} size="sm" variant={filter === item.value ? 'secondary' : 'ghost'} onClick={() => setFilter(item.value)}>{item.label}</Button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search requests" className="pl-9" />
          </div>
          <Button variant="outline" onClick={() => setSort(value => value === 'newest' ? 'oldest' : 'newest')}>{sort === 'newest' ? 'Newest' : 'Oldest'}</Button>
        </div>
      </div>

      {error ? <EmptyState title="Inbox unavailable" description={error.message} /> : loading ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Inbox />} title="Nothing in this queue" description="Try another filter or search term." />
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const needsResponse = item.license.status === 'REQUESTED' && item.latestOffer?.side === 'MOVIE_TEAM'
            return (
              <Card key={item.license.id} className={cn(needsResponse && persona.canNegotiate && 'border-amber-500/25 bg-amber-500/[0.03]')}>
                <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{item.song.title}</p>
                      <StatusBadge status={item.license.status} />
                      {needsResponse && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">Needs response</span>}
                    </div>
                    <p className="mt-1 truncate text-[12px] text-muted-foreground">{item.movie?.title ?? 'Movie'} · {item.scene?.title ?? 'Scene'} · {item.track.usage_type.toLowerCase()}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Updated {formatRelativeTime(item.license.updated_at)} · License #{item.license.id.slice(0, 8)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm md:min-w-64">
                    <div><p className="text-[10px] uppercase text-muted-foreground">Latest fee</p><p className="font-semibold tabular-nums">{formatCurrency(item.latestOffer?.license_fee, item.latestOffer?.currency)}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">Territory</p><p className="truncate font-medium">{item.latestOffer?.territory ?? '—'}</p></div>
                  </div>
                  <Button nativeButton={false} variant={needsResponse && persona.canNegotiate ? 'default' : 'outline'} render={<Link to={`/rights/licenses/${item.license.id}`} />}>
                    {needsResponse && persona.canNegotiate ? 'Respond' : 'View'} <ArrowRight />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
