import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, getApiMode } from '@/api'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/lib/use-async'
import { loadRightsLicenses, loadRightsSongs } from '@/lib/rights-data'
import { useRightsPersona } from '@/lib/rights-persona'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import { ArrowRight, CircleDollarSign, Clock3, Disc3, Inbox } from 'lucide-react'

async function loadDashboard(persona: ReturnType<typeof useRightsPersona>) {
  const [songs, licenses] = await Promise.all([
    loadRightsSongs(persona),
    loadRightsLicenses(persona),
  ])
  return { songs, licenses }
}

export function RightsDashboardPage() {
  const persona = useRightsPersona()
  const { data, loading, reload } = useAsync(
    () => loadDashboard(persona),
    [persona.id, persona.labelId, persona.user.id, getApiMode()],
  )

  useEffect(() => api.licenses.subscribeEvents(reload), [reload])

  const requests = data?.licenses ?? []
  const pending = requests.filter(item => item.license.status === 'REQUESTED')
  const awaitingResponse = pending.filter(item => item.latestOffer?.side === 'MOVIE_TEAM')
  const approved = requests.filter(item => item.license.status === 'APPROVED')
  const catalogValue = approved.reduce((sum, item) => sum + (item.latestOffer?.license_fee ?? 0), 0)

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title={persona.kind === 'label' ? `${persona.labelName} workspace` : `${persona.user.name}'s catalog`}
        description={persona.kind === 'label'
          ? persona.catalogScope === 'label'
            ? 'Manage your catalog and respond to licensing requests.'
            : 'Track your songs and the requests connected to them.'
          : 'Manage your independent catalog and negotiate directly with movie teams.'}
        actions={<Button nativeButton={false} render={<Link to="/rights/inbox" />}>Open inbox <ArrowRight /></Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Inbox />} label="Needs response" value={awaitingResponse.length} detail="Incoming offers" loading={loading} />
        <MetricCard icon={<Clock3 />} label="Active requests" value={pending.length} detail="In negotiation" loading={loading} />
        <MetricCard icon={<Disc3 />} label="Catalog songs" value={data?.songs.length ?? 0} detail={persona.catalogScope === 'artist' ? 'Your songs' : 'Label catalog'} loading={loading} />
        <MetricCard icon={<CircleDollarSign />} label="Approved value" value={formatCurrency(catalogValue, 'USD')} detail={`${approved.length} approved`} loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-sm">Priority requests</CardTitle>
              <CardDescription>Incoming offers waiting for your side.</CardDescription>
            </div>
            <Button nativeButton={false} variant="ghost" size="sm" render={<Link to="/rights/inbox" />}>View all</Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
            ) : awaitingResponse.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">No requests need a response.</p>
            ) : (
              <div className="divide-y divide-border">
                {awaitingResponse.slice(0, 4).map(item => (
                  <Link
                    key={item.license.id}
                    to={`/rights/licenses/${item.license.id}`}
                    className="flex items-center gap-3 py-3 transition-colors hover:text-foreground"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{item.song.title}</p>
                        <StatusBadge status={item.license.status} />
                      </div>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {item.movie?.title ?? 'Movie'} · {item.scene?.title ?? 'Scene'} · {formatRelativeTime(item.license.updated_at)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(item.latestOffer?.license_fee, item.latestOffer?.currency)}</p>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent activity</CardTitle>
            <CardDescription>Latest catalog negotiations.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48" /> : (
              <div className="space-y-4">
                {requests.slice(0, 5).map(item => (
                  <div key={item.license.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{item.song.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.license.status === 'REQUESTED' ? 'Negotiation updated' : `Request ${item.license.status.toLowerCase()}`} · {formatRelativeTime(item.license.updated_at)}
                      </p>
                    </div>
                  </div>
                ))}
                {requests.length === 0 && <p className="text-[13px] text-muted-foreground">No activity yet.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, detail, loading }: { icon: React.ReactNode; label: string; value: string | number; detail: string; loading: boolean }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
          <span className="[&_svg]:size-4">{icon}</span>
        </div>
        {loading ? <Skeleton className="mt-3 h-8 w-20" /> : <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>}
        <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}
