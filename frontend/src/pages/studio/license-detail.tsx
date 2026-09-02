import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { NegotiationTimeline } from '@/components/negotiation-timeline'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { api, getApiMode } from '@/api'
import { useAsync } from '@/lib/use-async'
import { userName } from '@/lib/user-name'
import { useAuth } from '@/lib/auth'
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils'
import {
  ArrowRight,
  Ban,
  ChevronDown,
  CircleCheck,
  CircleX,
  HandCoins,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import type { LicenseOffer, LicenseRequest, OfferTerms, Scene, Song } from '@/types'

interface LicenseDetailData {
  license: LicenseRequest
  offers: LicenseOffer[]
  song?: Song
  scene?: Scene
  movieId?: string
  movieTitle?: string
}

async function loadLicenseDetail(licenseId: string): Promise<LicenseDetailData> {
  const [license, offers] = await Promise.all([
    api.licenses.get(licenseId),
    api.licenses.listOffers(licenseId),
  ])
  const track = await api.tracks.get(license.track_id)
  const [song, scene] = await Promise.all([
    api.songs.get(track.song_id).catch(() => undefined),
    api.scenes.get(track.scene_id).catch(() => undefined),
  ])
  let movieId: string | undefined
  let movieTitle: string | undefined
  if (scene) {
    movieId = scene.movie_id
    movieTitle = (await api.movies.get(scene.movie_id).catch(() => undefined))?.title
  }
  return { license, offers, song, scene, movieId, movieTitle }
}

/** Explicit, plain-language description of what should happen next, from the
 *  movie team's point of view (the only actor in this Studio app). */
function getWhatsNext(license: LicenseRequest, waitingOnRightsHolder: boolean): { title: string; description: string } {
  switch (license.status) {
    case 'DRAFT':
      return {
        title: 'Submit your offer',
        description: 'This license is still a draft. Submit it to the rights holder to start the negotiation.',
      }
    case 'REQUESTED':
      return waitingOnRightsHolder
        ? {
            title: 'Waiting on the rights holder',
            description: "You've sent an offer. The rights holder needs to accept, counter, or reject it before you can proceed.",
          }
        : {
            title: 'Respond to their counter-offer',
            description: 'The rights holder proposed new terms. Accept the offer, send a counter, or reject it to end the negotiation.',
          }
    case 'APPROVED':
      return {
        title: 'License signed',
        description: 'Both sides agreed to the terms below. No further action is needed.',
      }
    case 'REJECTED':
      return {
        title: 'Request rejected',
        description: license.rejection_reason
          ? `This request was rejected: "${license.rejection_reason}"`
          : 'This request was rejected.',
      }
    case 'CANCELLED':
      return {
        title: 'Request cancelled',
        description: 'This request was withdrawn and is no longer active.',
      }
    default:
      return { title: 'Review license', description: '' }
  }
}

const FIELD_LABELS: { key: keyof LicenseOffer; label: string; format: (offer: LicenseOffer) => string }[] = [
  { key: 'license_fee', label: 'Fee', format: o => formatCurrency(o.license_fee, o.currency) },
  { key: 'territory', label: 'Territory', format: o => o.territory ?? '—' },
  { key: 'media_rights', label: 'Media rights', format: o => o.media_rights ?? '—' },
  { key: 'exclusive', label: 'Exclusivity', format: o => (o.exclusive ? 'Exclusive' : 'Non-exclusive') },
  { key: 'license_start', label: 'Start', format: o => o.license_start ?? '—' },
  { key: 'license_end', label: 'End', format: o => o.license_end ?? '—' },
]

export function StudioLicenseDetailPage() {
  const { licenseId = '' } = useParams()
  const { data, loading, error, reload } = useAsync(
    () => loadLicenseDetail(licenseId),
    [licenseId, getApiMode()],
  )

  // Live-update from the SSE / mock event bus.
  useEffect(() => {
    return api.licenses.subscribeEvents(event => {
      if (event.license_id === licenseId) reload()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenseId])

  if (error) {
    return <EmptyState title="License not found" description={error.message} />
  }

  const sortedOffers = data ? [...data.offers].sort((a, b) => a.offer_number - b.offer_number) : []
  const latestOffer = sortedOffers[sortedOffers.length - 1]
  const previousOffer = sortedOffers[sortedOffers.length - 2]
  const waitingOnRightsHolder = latestOffer?.side === 'MOVIE_TEAM'
  const timelineOffers = data?.offers.map(o => ({ ...o, proposer_name: userName(o.proposed_by, o.proposed_by_name) })) ?? []

  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumbs
        items={[
          { label: 'Licenses', href: '/studio/licenses' },
          ...(data?.movieId ? [{ label: data.movieTitle ?? 'Movie', href: `/studio/movies/${data.movieId}` }] : []),
          { label: loading ? 'License' : `License #${licenseId.slice(0, 8)}` },
        ]}
      />

      <PageHeader
        title={loading ? 'Loading...' : `License #${licenseId.slice(0, 8)}`}
        description={data ? `${data.song?.title ?? 'Song'} · ${data.scene?.title ?? 'Scene'} · ${data.movieTitle ?? 'Movie'}` : undefined}
      />

      {loading ? (
        <Skeleton className="h-72" />
      ) : data ? (
        <>
          {/* Contextual summary: song / scene / movie */}
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Song</p>
                <p className="mt-0.5 truncate text-sm font-medium">{data.song?.title ?? 'Unknown song'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Scene</p>
                <p className="mt-0.5 truncate text-sm font-medium">{data.scene?.title ?? 'Unknown scene'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Movie</p>
                <p className="mt-0.5 truncate text-sm font-medium">{data.movieTitle ?? 'Unknown movie'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Prominent current terms */}
          {latestOffer && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Current terms</CardTitle>
                <CardDescription className="text-[12px]">
                  Offer #{latestOffer.offer_number} · {formatRelativeTime(latestOffer.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-3xl font-semibold tabular-nums">
                  {formatCurrency(latestOffer.license_fee, latestOffer.currency)}
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Territory</p>
                    <p className="mt-0.5 text-sm font-medium">{latestOffer.territory ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Exclusivity</p>
                    <p className="mt-0.5 text-sm font-medium">{latestOffer.exclusive ? 'Exclusive' : 'Non-exclusive'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Media rights</p>
                    <p className="mt-0.5 text-sm font-medium">{latestOffer.media_rights ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Window</p>
                    <p className="mt-0.5 text-sm font-medium">
                      {latestOffer.license_start ?? '—'} → {latestOffer.license_end ?? '—'}
                    </p>
                  </div>
                </div>
                {latestOffer.notes && (
                  <p className="text-[13px] text-muted-foreground">{latestOffer.notes}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Explicit what's-next panel */}
          <WhatsNextPanel license={data.license} waitingOnRightsHolder={waitingOnRightsHolder} />

          {/* Collapsible comparison against the previous offer */}
          {latestOffer && previousOffer && (
            <OfferComparison previous={previousOffer} latest={latestOffer} />
          )}

          <NegotiationTimeline
            status={data.license.status}
            offers={timelineOffers}
            songTitle={data.song?.title}
            sceneTitle={data.scene?.title}
            movieTitle={data.movieTitle}
            resolvedByName={data.license.resolved_by ? userName(data.license.resolved_by, data.license.resolved_by_name) : undefined}
          />

          <StudioActions
            license={data.license}
            waitingOnRightsHolder={waitingOnRightsHolder}
            onChanged={reload}
          />
        </>
      ) : null}
    </div>
  )
}

function WhatsNextPanel({ license, waitingOnRightsHolder }: { license: LicenseRequest; waitingOnRightsHolder: boolean }) {
  const { title, description } = getWhatsNext(license, waitingOnRightsHolder)
  const isActive = license.status === 'DRAFT' || license.status === 'REQUESTED'

  return (
    <Card className={cn(isActive && 'border-primary/30 bg-primary/5')}>
      <CardContent className="flex items-start gap-3 py-4">
        <div className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
          isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}>
          <ArrowRight className="size-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">What's next: {title}</p>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function OfferComparison({ previous, latest }: { previous: LicenseOffer; latest: LicenseOffer }) {
  const [open, setOpen] = useState(false)
  const rows = FIELD_LABELS.map(field => ({
    label: field.label,
    prevValue: field.format(previous),
    newValue: field.format(latest),
    changed: field.format(previous) !== field.format(latest),
  }))
  const changedCount = rows.filter(r => r.changed).length

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-(--card-spacing) py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-xl"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold">Compare with previous offer</p>
          <p className="text-[12px] text-muted-foreground">
            Offer #{previous.offer_number} → #{latest.offer_number}
            {changedCount > 0 ? ` · ${changedCount} term${changedCount !== 1 ? 's' : ''} changed` : ' · No changes'}
          </p>
        </div>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            {rows.map(row => (
              <div
                key={row.label}
                className={cn(
                  'grid grid-cols-3 gap-2 rounded-md px-2 py-1.5 text-[13px]',
                  row.changed && 'bg-amber-500/10',
                )}
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className={cn(row.changed && 'text-muted-foreground line-through')}>{row.prevValue}</span>
                <span className={cn('font-medium', row.changed && 'text-amber-400')}>{row.newValue}</span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

function StudioActions({
  license,
  waitingOnRightsHolder,
  onChanged,
}: {
  license: LicenseRequest
  waitingOnRightsHolder: boolean
  onChanged: () => void
}) {
  const [counterOpen, setCounterOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function run(action: string, fn: () => Promise<unknown>, successMessage: string) {
    setBusy(action)
    try {
      await fn()
      toast.success(successMessage)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  if (license.status === 'DRAFT') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Draft actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="w-full sm:w-auto"
            disabled={busy !== null}
            onClick={() => run('submit', () => api.licenses.submit(license.id), 'License submitted for review')}
          >
            <Send /> {busy === 'submit' ? 'Submitting...' : 'Submit to rights holder'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (license.status === 'REQUESTED') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Negotiation actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {waitingOnRightsHolder ? (
            <Badge variant="secondary" className="text-[11px]">Waiting on rights holder to respond</Badge>
          ) : (
            <>
              <Button
                className="w-full sm:w-auto"
                disabled={busy !== null}
                onClick={() => run('accept', () => api.licenses.accept(license.id), 'Offer accepted')}
              >
                <CircleCheck /> Accept offer
              </Button>
              <Dialog open={counterOpen} onOpenChange={setCounterOpen}>
                <DialogTrigger render={<Button className="w-full sm:w-auto" variant="outline" disabled={busy !== null}><HandCoins /> Counter</Button>} />
                <CounterOfferDialog
                  licenseId={license.id}
                  onSubmitted={() => {
                    setCounterOpen(false)
                    onChanged()
                  }}
                />
              </Dialog>
              <RejectDialog licenseId={license.id} onRejected={onChanged} disabled={busy !== null} />
            </>
          )}
          <Button
            className="w-full sm:ml-auto sm:w-auto"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => run('cancel', () => api.licenses.cancel(license.id), 'Request cancelled')}
          >
            <Ban /> Cancel request
          </Button>
        </CardContent>
      </Card>
    )
  }

  return null
}

function CounterOfferDialog({ licenseId, onSubmitted }: { licenseId: string; onSubmitted: () => void }) {
  const { user } = useAuth()
  const [fee, setFee] = useState('')
  const [territory, setTerritory] = useState('')
  const [exclusive, setExclusive] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const terms: OfferTerms = {
        license_fee: fee ? Number(fee) : null,
        currency: 'USD',
        territory: territory || null,
        exclusive,
        notes: notes || null,
      }
      await api.licenses.counterOffer(licenseId, terms)
      toast.success('Counter-offer sent')
      onSubmitted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send counter-offer')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Counter-offer</DialogTitle>
          <DialogDescription>Propose new terms to the rights holder as {user?.name ?? 'you'}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="counter-fee">License fee (USD)</Label>
              <Input id="counter-fee" type="number" value={fee} onChange={e => setFee(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="counter-territory">Territory</Label>
              <Input id="counter-territory" value={territory} onChange={e => setTerritory(e.target.value)} placeholder="Worldwide" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="counter-exclusive" checked={exclusive} onCheckedChange={setExclusive} />
            <Label htmlFor="counter-exclusive" className="text-[13px]">Exclusive rights</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="counter-notes">Notes</Label>
            <Textarea id="counter-notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send counter-offer'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function RejectDialog({ licenseId, onRejected, disabled }: { licenseId: string; onRejected: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return
    setSubmitting(true)
    try {
      await api.licenses.reject(licenseId, reason)
      toast.success('Offer rejected')
      setOpen(false)
      onRejected()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject offer')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full sm:w-auto" variant="outline" disabled={disabled}><CircleX /> Reject</Button>} />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Reject offer</DialogTitle>
            <DialogDescription>Let the rights holder know why this offer doesn't work.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-1.5">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea id="reject-reason" value={reason} onChange={e => setReason(e.target.value)} autoFocus required />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={submitting || !reason.trim()}>
              {submitting ? 'Rejecting...' : 'Reject offer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
