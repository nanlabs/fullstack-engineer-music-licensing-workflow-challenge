import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, getApiMode } from '@/api'
import { setMockActorId } from '@/api/mock/actor'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { EmptyState } from '@/components/empty-state'
import { NegotiationTimeline } from '@/components/negotiation-timeline'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAsync } from '@/lib/use-async'
import { loadRightsLicenseDetail } from '@/lib/rights-data'
import { useRightsPersona } from '@/lib/rights-persona'
import { userName } from '@/lib/user-name'
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils'
import { ArrowRight, CircleCheck, CircleX, Eye, HandCoins } from 'lucide-react'
import { toast } from 'sonner'
import type { LicenseOffer, OfferTerms } from '@/types'

export function RightsLicenseDetailPage() {
  const { licenseId = '' } = useParams()
  const persona = useRightsPersona()
  const { data, loading, error, reload } = useAsync(
    () => loadRightsLicenseDetail(persona, licenseId),
    [persona.id, persona.labelId, persona.user.id, licenseId, getApiMode()],
  )

  useEffect(() => {
    setMockActorId(persona.user.id)
    return () => setMockActorId(null)
  }, [persona.user.id])

  useEffect(() => api.licenses.subscribeEvents(event => {
    if (event.license_id === licenseId) reload()
  }), [licenseId, reload])

  if (error) return <EmptyState title="License unavailable" description={error.message} />
  if (!loading && !data) return <EmptyState title="License unavailable" description="This request is not part of the current catalog." />

  const offers = data ? [...data.offers].sort((a, b) => a.offer_number - b.offer_number) : []
  const latest = offers[offers.length - 1]
  const previous = offers[offers.length - 2]
  const needsRightsResponse = data?.license.status === 'REQUESTED' && latest?.side === 'MOVIE_TEAM'
  const waitingOnMovieTeam = data?.license.status === 'REQUESTED' && latest?.side === 'RIGHTS_HOLDER'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Breadcrumbs items={[{ label: 'Incoming requests', href: '/rights/inbox' }, { label: `License #${licenseId.slice(0, 8)}` }]} />
      <PageHeader
        title={loading ? 'Loading...' : `License #${licenseId.slice(0, 8)}`}
        description={data ? `${data.song.title} · ${data.scene?.title ?? 'Scene'} · ${data.movie?.title ?? 'Movie'}` : undefined}
      />

      {loading ? <Skeleton className="h-96" /> : data ? (
        <>
          <Card>
            <CardContent className="grid gap-4 py-4 sm:grid-cols-3">
              <Metadata label="Song" value={data.song.title} href={`/rights/catalog/${data.song.id}`} />
              <Metadata label="Placement" value={`${data.movie?.title ?? 'Movie'} · ${data.scene?.title ?? 'Scene'}`} />
              <Metadata label="Usage" value={`${data.track.usage_type.toLowerCase()} · ${data.track.duration_seconds}s`} />
            </CardContent>
          </Card>

          {latest && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Current offer</CardTitle>
                <CardDescription>Offer #{latest.offer_number} · from {latest.side === 'MOVIE_TEAM' ? 'movie team' : 'rights holder'} · {formatRelativeTime(latest.created_at)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-3xl font-semibold tabular-nums">{formatCurrency(latest.license_fee, latest.currency)}</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Metadata label="Territory" value={latest.territory ?? '—'} />
                  <Metadata label="Rights" value={latest.media_rights ?? '—'} />
                  <Metadata label="Exclusivity" value={latest.exclusive ? 'Exclusive' : 'Non-exclusive'} />
                  <Metadata label="Window" value={latest.license_start || latest.license_end ? `${latest.license_start ?? 'Open'} → ${latest.license_end ?? 'Open'}` : 'Open-ended'} />
                </div>
                {latest.notes && <p className="rounded-lg bg-muted/50 p-3 text-[13px] text-muted-foreground">{latest.notes}</p>}
              </CardContent>
            </Card>
          )}

          <NextStep
            canNegotiate={persona.canNegotiate}
            needsRightsResponse={needsRightsResponse}
            waitingOnMovieTeam={waitingOnMovieTeam}
            status={data.license.status}
          />

          {latest && previous && <OfferComparison previous={previous} latest={latest} />}

          <NegotiationTimeline
            status={data.license.status}
            offers={offers.map(offer => ({ ...offer, proposer_name: userName(offer.proposed_by, offer.proposed_by_name) }))}
            songTitle={data.song.title}
            sceneTitle={data.scene?.title}
            movieTitle={data.movie?.title}
            resolvedByName={data.license.resolved_by ? userName(data.license.resolved_by, data.license.resolved_by_name) : undefined}
          />

          {persona.canNegotiate && needsRightsResponse && <RightsActions licenseId={data.license.id} latest={latest} onChanged={reload} />}
        </>
      ) : null}
    </div>
  )
}

function Metadata({ label, value, href }: { label: string; value: string; href?: string }) {
  return <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>{href ? <Link to={href} className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium hover:text-primary">{value} <ArrowRight className="size-3" /></Link> : <p className="mt-0.5 text-sm font-medium">{value}</p>}</div>
}

function NextStep({ canNegotiate, needsRightsResponse, waitingOnMovieTeam, status }: { canNegotiate: boolean; needsRightsResponse: boolean; waitingOnMovieTeam: boolean; status: string }) {
  let title = 'Request closed'
  let description = 'This negotiation is complete and no further action is available.'
  if (status === 'REQUESTED' && needsRightsResponse) {
    title = canNegotiate ? 'Review the incoming offer' : 'Label team response needed'
    description = canNegotiate ? 'Accept these terms, counter with new terms, or reject the request with a reason.' : 'An owner or representative must respond. You can follow the negotiation here.'
  } else if (status === 'REQUESTED' && waitingOnMovieTeam) {
    title = 'Waiting on the movie team'
    description = 'Your side sent a counter-offer. The movie team must respond next.'
  }

  return (
    <Card className={cn(status === 'REQUESTED' && 'border-primary/30 bg-primary/5')}>
      <CardContent className="flex gap-3 py-4">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">{canNegotiate ? <ArrowRight className="size-4" /> : <Eye className="size-4" />}</div>
        <div><p className="text-sm font-semibold">What's next: {title}</p><p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p></div>
      </CardContent>
    </Card>
  )
}

function OfferComparison({ previous, latest }: { previous: LicenseOffer; latest: LicenseOffer }) {
  const rows = [
    ['Fee', formatCurrency(previous.license_fee, previous.currency), formatCurrency(latest.license_fee, latest.currency)],
    ['Territory', previous.territory ?? '—', latest.territory ?? '—'],
    ['Rights', previous.media_rights ?? '—', latest.media_rights ?? '—'],
    ['Exclusivity', previous.exclusive ? 'Exclusive' : 'Non-exclusive', latest.exclusive ? 'Exclusive' : 'Non-exclusive'],
  ]
  return (
    <Card><CardHeader><CardTitle className="text-sm">Changes from previous offer</CardTitle></CardHeader><CardContent className="space-y-1.5">
      {rows.map(([label, before, after]) => <div key={label} className={cn('grid grid-cols-3 gap-3 rounded-md px-2 py-2 text-[13px]', before !== after && 'bg-amber-500/10')}><span className="text-muted-foreground">{label}</span><span className={cn(before !== after && 'line-through text-muted-foreground')}>{before}</span><span className={cn('font-medium', before !== after && 'text-amber-400')}>{after}</span></div>)}
    </CardContent></Card>
  )
}

function RightsActions({ licenseId, latest, onChanged }: { licenseId: string; latest?: LicenseOffer; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [counterOpen, setCounterOpen] = useState(false)

  async function accept() {
    setBusy(true)
    try { await api.licenses.accept(licenseId); toast.success('Offer accepted'); onChanged() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to accept offer') }
    finally { setBusy(false) }
  }

  return (
    <Card><CardHeader><CardTitle className="text-sm">Respond to request</CardTitle><CardDescription>Your response is sent to the movie team immediately.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Button disabled={busy} onClick={accept}><CircleCheck /> Accept offer</Button>
        <Dialog open={counterOpen} onOpenChange={setCounterOpen}>
          <DialogTrigger render={<Button variant="outline" disabled={busy}><HandCoins /> Counter-offer</Button>} />
          <CounterDialog licenseId={licenseId} latest={latest} onDone={() => { setCounterOpen(false); onChanged() }} />
        </Dialog>
        <RejectDialog licenseId={licenseId} disabled={busy} onDone={onChanged} />
      </CardContent>
    </Card>
  )
}

function CounterDialog({ licenseId, latest, onDone }: { licenseId: string; latest?: LicenseOffer; onDone: () => void }) {
  const [fee, setFee] = useState(latest?.license_fee != null ? String(latest.license_fee) : '')
  const [territory, setTerritory] = useState(latest?.territory ?? '')
  const [rights, setRights] = useState(latest?.media_rights ?? '')
  const [exclusive, setExclusive] = useState(latest?.exclusive ?? false)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true)
    const terms: OfferTerms = { license_fee: fee ? Number(fee) : null, currency: latest?.currency ?? 'USD', territory: territory || null, media_rights: rights || null, exclusive, notes: notes || null }
    try { await api.licenses.counterOffer(licenseId, terms); toast.success('Counter-offer sent'); onDone() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to send counter-offer') }
    finally { setBusy(false) }
  }

  return <DialogContent><form onSubmit={submit}><DialogHeader><DialogTitle>Counter-offer</DialogTitle><DialogDescription>Propose revised licensing terms to the movie team.</DialogDescription></DialogHeader><div className="grid gap-4 py-4 sm:grid-cols-2">
    <Field label="Fee" id="rights-fee"><Input id="rights-fee" type="number" value={fee} onChange={event => setFee(event.target.value)} /></Field>
    <Field label="Territory" id="rights-territory"><Input id="rights-territory" value={territory} onChange={event => setTerritory(event.target.value)} /></Field>
    <Field label="Media rights" id="rights-media"><Input id="rights-media" value={rights} onChange={event => setRights(event.target.value)} /></Field>
    <div className="flex items-center gap-2 pt-6"><Switch id="rights-exclusive" checked={exclusive} onCheckedChange={setExclusive} /><Label htmlFor="rights-exclusive">Exclusive rights</Label></div>
    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="rights-notes">Notes</Label><Textarea id="rights-notes" value={notes} onChange={event => setNotes(event.target.value)} /></div>
  </div><DialogFooter><Button type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send counter-offer'}</Button></DialogFooter></form></DialogContent>
}

function RejectDialog({ licenseId, disabled, onDone }: { licenseId: string; disabled: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); try { await api.licenses.reject(licenseId, reason); toast.success('Request rejected'); setOpen(false); onDone() } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to reject request') } finally { setBusy(false) } }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button variant="outline" disabled={disabled}><CircleX /> Reject</Button>} /><DialogContent><form onSubmit={submit}><DialogHeader><DialogTitle>Reject request</DialogTitle><DialogDescription>Explain why these terms cannot be accepted.</DialogDescription></DialogHeader><div className="space-y-1.5 py-4"><Label htmlFor="rights-reason">Reason</Label><Textarea id="rights-reason" value={reason} onChange={event => setReason(event.target.value)} required /></div><DialogFooter><Button type="submit" variant="destructive" disabled={busy || !reason.trim()}>{busy ? 'Rejecting...' : 'Reject request'}</Button></DialogFooter></form></DialogContent></Dialog>
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div> }
