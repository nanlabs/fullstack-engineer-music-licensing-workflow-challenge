import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, getApiMode } from '@/api'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { UsageBadge } from '@/components/role-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/lib/use-async'
import { loadRightsSongs, loadSongPlacements } from '@/lib/rights-data'
import { useRightsPersona } from '@/lib/rights-persona'
import { userName } from '@/lib/user-name'
import { formatCurrency, formatTime } from '@/lib/utils'
import { ArrowRight, Clapperboard, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { Song } from '@/types'

async function loadDetail(persona: ReturnType<typeof useRightsPersona>, songId: string) {
  const catalog = await loadRightsSongs(persona)
  const song = catalog.find(item => item.id === songId)
  if (!song) throw new Error('This song is not available in the current catalog.')
  return { song, placements: await loadSongPlacements(song) }
}

export function RightsSongDetailPage() {
  const { songId = '' } = useParams()
  const persona = useRightsPersona()
  const { data, loading, error, reload } = useAsync(
    () => loadDetail(persona, songId),
    [persona.id, persona.labelId, persona.user.id, songId, getApiMode()],
  )

  if (error) return <EmptyState title="Song unavailable" description={error.message} />

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Breadcrumbs items={[{ label: 'Catalog', href: '/rights/catalog' }, { label: data?.song.title ?? 'Song' }]} />
      <PageHeader
        title={data?.song.title ?? 'Song'}
        description={data ? [data.song.album, data.song.genre, formatTime(data.song.duration_seconds)].filter(Boolean).join(' · ') : undefined}
        actions={data && <EditSongDialog song={data.song} onUpdated={reload} />}
      />

      {loading ? <Skeleton className="h-72" /> : data ? (
        <>
          <Card>
            <CardContent className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metadata label="Artist" value={userName(data.song.artist_id, data.song.artist_name)} />
              <Metadata label="Representation" value={persona.labelName ?? 'Independent'} />
              <Metadata label="ISRC" value={data.song.isrc ?? 'Not assigned'} mono />
              <Metadata label="Placements" value={String(data.placements.length)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Placements and license history</CardTitle>
              <CardDescription>Where this song is being used across movies and scenes.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.placements.length === 0 ? (
                <EmptyState icon={<Clapperboard />} title="No placements" description="This song has not been placed in a scene yet." className="py-10" />
              ) : (
                <div className="divide-y divide-border">
                  {data.placements.map(({ track, scene, movie, license, offers }) => {
                    const latestOffer = [...offers].sort((a, b) => b.offer_number - a.offer_number)[0]
                    return (
                      <div key={track.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{movie?.title ?? 'Unknown movie'}</p>
                            <UsageBadge usage={track.usage_type} />
                            {license && <StatusBadge status={license.status} />}
                          </div>
                          <p className="mt-1 text-[12px] text-muted-foreground">
                            {scene?.title ?? 'Unknown scene'} · {formatTime(track.start_time_seconds)}–{formatTime(track.end_time_seconds)} · {track.duration_seconds}s used
                          </p>
                        </div>
                        {latestOffer && <p className="text-sm font-semibold tabular-nums">{formatCurrency(latestOffer.license_fee, latestOffer.currency)}</p>}
                        {license ? (
                          <Button nativeButton={false} variant="ghost" size="sm" render={<Link to={`/rights/licenses/${license.id}`} />}>
                            View license <ArrowRight />
                          </Button>
                        ) : <span className="text-[11px] text-muted-foreground">No request received</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function Metadata({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-0.5 truncate text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</p></div>
}

function EditSongDialog({ song, onUpdated }: { song: Song; onUpdated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(song.title)
  const [album, setAlbum] = useState(song.album ?? '')
  const [genre, setGenre] = useState(song.genre ?? '')
  const [isrc, setIsrc] = useState(song.isrc ?? '')
  const [duration, setDuration] = useState(String(song.duration_seconds))
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await api.songs.update(song.id, { title, album: album || null, genre: genre || null, isrc: isrc || null, duration_seconds: Number(duration) })
      toast.success('Song metadata updated')
      setOpen(false)
      onUpdated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update song')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline"><Pencil /> Edit metadata</Button>} />
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>Edit song</DialogTitle><DialogDescription>Update catalog metadata for this song.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <Field label="Title" id="edit-title"><Input id="edit-title" value={title} onChange={event => setTitle(event.target.value)} required /></Field>
            <Field label="Duration (seconds)" id="edit-duration"><Input id="edit-duration" type="number" min="1" value={duration} onChange={event => setDuration(event.target.value)} required /></Field>
            <Field label="Album" id="edit-album"><Input id="edit-album" value={album} onChange={event => setAlbum(event.target.value)} /></Field>
            <Field label="Genre" id="edit-genre"><Input id="edit-genre" value={genre} onChange={event => setGenre(event.target.value)} /></Field>
            <Field label="ISRC" id="edit-isrc"><Input id="edit-isrc" value={isrc} onChange={event => setIsrc(event.target.value)} /></Field>
          </div>
          <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save changes'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>
}
