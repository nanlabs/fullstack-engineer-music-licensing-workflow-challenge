import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Combobox, type ComboboxItem } from '@/components/ui/combobox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UsageBadge } from '@/components/role-badge'
import { StatusBadge } from '@/components/status-badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, getApiMode } from '@/api'
import { useAsync } from '@/lib/use-async'
import { cn, formatCurrency, formatTime } from '@/lib/utils'
import { userName } from '@/lib/user-name'
import { Music, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { LicenseOffer, LicenseRequest, Song, Track, UsageType } from '@/types'

interface SceneDetailData {
  tracks: Track[]
  songsById: Record<string, Song>
  licenseByTrack: Record<string, LicenseRequest | null>
  latestOfferByTrack: Record<string, LicenseOffer | undefined>
}

async function loadSceneDetail(sceneId: string): Promise<SceneDetailData> {
  const tracks = await api.scenes.listTracks(sceneId)
  const songs = await Promise.all(tracks.map(t => api.songs.get(t.song_id)))
  const songsById = Object.fromEntries(songs.map(s => [s.id, s]))
  const licenseByTrack: Record<string, LicenseRequest | null> = {}
  const latestOfferByTrack: Record<string, LicenseOffer | undefined> = {}
  await Promise.all(
    tracks.map(async track => {
      const license = await api.tracks.getLicense(track.id).catch(() => null)
      licenseByTrack[track.id] = license
      if (license) {
        const offers = await api.licenses.listOffers(license.id).catch(() => [])
        latestOfferByTrack[track.id] = [...offers].sort((a, b) => b.offer_number - a.offer_number)[0]
      }
    }),
  )
  return { tracks, songsById, licenseByTrack, latestOfferByTrack }
}

/** Context-aware label for what should happen next on a track's license. */
function getNextAction(license: LicenseRequest | null, latestOffer?: LicenseOffer): { label: string; muted?: boolean } {
  if (!license) return { label: 'Not yet requested', muted: true }
  switch (license.status) {
    case 'DRAFT':
      return { label: 'Submit for review' }
    case 'REQUESTED':
      return latestOffer?.side === 'MOVIE_TEAM'
        ? { label: 'Awaiting rights holder', muted: true }
        : { label: 'Review counter-offer' }
    case 'APPROVED':
      return { label: 'Signed — view terms', muted: true }
    case 'REJECTED':
      return { label: 'Rejected — view reason', muted: true }
    case 'CANCELLED':
      return { label: 'Cancelled', muted: true }
    default:
      return { label: 'View license' }
  }
}

export function StudioSceneDetailPage() {
  const { movieId = '', sceneId = '' } = useParams()
  const navigate = useNavigate()
  const [addTrackOpen, setAddTrackOpen] = useState(false)

  const { data: movie } = useAsync(() => api.movies.get(movieId), [movieId, getApiMode()])
  const { data: scene, loading: sceneLoading, error: sceneError } = useAsync(
    () => api.scenes.get(sceneId),
    [sceneId, getApiMode()],
  )
  const { data, loading, error, reload } = useAsync(
    () => loadSceneDetail(sceneId),
    [sceneId, getApiMode()],
  )

  if (sceneError) {
    return <EmptyState title="Scene not found" description={sceneError.message} />
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Breadcrumbs
        items={[
          { label: 'Movies', href: '/studio/movies' },
          { label: movie?.title ?? 'Movie', href: `/studio/movies/${movieId}` },
          { label: sceneLoading ? 'Scene' : scene?.title ?? 'Scene' },
        ]}
      />

      <PageHeader
        title={sceneLoading ? 'Loading...' : scene?.title ?? 'Scene'}
        description={scene ? `Scene #${scene.scene_number} · ${scene.duration_seconds}s` : undefined}
        actions={
          <Dialog open={addTrackOpen} onOpenChange={setAddTrackOpen}>
            <DialogTrigger render={<Button size="sm"><Plus /> Add Track</Button>} />
            <AddTrackDialog
              sceneId={sceneId}
              onCreated={() => {
                setAddTrackOpen(false)
                reload()
              }}
            />
          </Dialog>
        }
      />

      {scene && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Scene #</p>
              <p className="mt-0.5 text-sm font-medium tabular-nums">{scene.scene_number}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Timecode</p>
              <p className="mt-0.5 text-sm font-medium tabular-nums">
                {formatTime(scene.start_time)}–{formatTime(scene.end_time)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Duration</p>
              <p className="mt-0.5 text-sm font-medium tabular-nums">{formatTime(scene.duration_seconds)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tracks placed</p>
              <p className="mt-0.5 text-sm font-medium tabular-nums">{data?.tracks.length ?? 0}</p>
            </div>
          </CardContent>
          {scene.description && (
            <CardContent className="pt-0">
              <p className="text-[13px] text-muted-foreground">{scene.description}</p>
            </CardContent>
          )}
        </Card>
      )}

      {error && <EmptyState title="Couldn't load tracks" description={error.message} />}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : data && data.tracks.length > 0 ? (
        <>
          {/* Desktop / tablet: dense table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Song</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Clip</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead className="text-right">Latest fee</TableHead>
                  <TableHead>Next action</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.tracks.map(track => {
                  const song = data.songsById[track.song_id]
                  const license = data.licenseByTrack[track.id]
                  const latestOffer = data.latestOfferByTrack[track.id]
                  const nextAction = getNextAction(license, latestOffer)
                  return (
                    <TableRow key={track.id}>
                      <TableCell className="font-medium text-[13px]">{song?.title ?? track.song_id}</TableCell>
                      <TableCell><UsageBadge usage={track.usage_type} /></TableCell>
                      <TableCell className="font-mono text-[12px] text-muted-foreground">
                        {formatTime(track.start_time_seconds)}–{formatTime(track.end_time_seconds)}
                      </TableCell>
                      <TableCell>
                        {license ? <StatusBadge status={license.status} /> : (
                          <span className="text-[12px] text-muted-foreground">Not requested</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px]">
                        {formatCurrency(latestOffer?.license_fee, latestOffer?.currency)}
                      </TableCell>
                      <TableCell className={cn('text-[12px]', nextAction.muted && 'text-muted-foreground')}>
                        {nextAction.label}
                      </TableCell>
                      <TableCell className="text-right">
                        {license ? (
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/studio/licenses/${license.id}`)}>
                            View license
                          </Button>
                        ) : (
                          <RequestLicenseButton trackId={track.id} onRequested={reload} />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="space-y-3 md:hidden">
            {data.tracks.map(track => {
              const song = data.songsById[track.song_id]
              const license = data.licenseByTrack[track.id]
              const latestOffer = data.latestOfferByTrack[track.id]
              const nextAction = getNextAction(license, latestOffer)
              return (
                <Card key={track.id}>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{song?.title ?? track.song_id}</p>
                        <p className="mt-0.5 text-[12px] font-mono text-muted-foreground">
                          {formatTime(track.start_time_seconds)}–{formatTime(track.end_time_seconds)}
                        </p>
                        {track.notes && (
                          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{track.notes}</p>
                        )}
                      </div>
                      <UsageBadge usage={track.usage_type} />
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">Latest fee</span>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(latestOffer?.license_fee, latestOffer?.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">License</span>
                      {license ? <StatusBadge status={license.status} /> : (
                        <span className="text-[12px] text-muted-foreground">Not requested</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <span className={cn('text-[12px] font-medium', nextAction.muted && 'font-normal text-muted-foreground')}>
                        {nextAction.label}
                      </span>
                      {license ? (
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/studio/licenses/${license.id}`)}>
                          View
                        </Button>
                      ) : (
                        <RequestLicenseButton trackId={track.id} onRequested={reload} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      ) : (
        <EmptyState
          icon={<Music className="size-5" />}
          title="No tracks placed"
          description="Add a song to this scene to start the licensing process."
          action={{ label: 'Add Track', onClick: () => setAddTrackOpen(true) }}
        />
      )}
    </div>
  )
}

function RequestLicenseButton({ trackId, onRequested }: { trackId: string; onRequested: () => void }) {
  const [submitting, setSubmitting] = useState(false)

  async function handleClick() {
    setSubmitting(true)
    try {
      await api.licenses.create({ track_id: trackId })
      toast.success('License draft created')
      onRequested()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create license request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={submitting}>
      {submitting ? 'Requesting...' : 'Request License'}
    </Button>
  )
}

const USAGE_TYPES: UsageType[] = ['BACKGROUND', 'FEATURED', 'CREDITS', 'TRAILER']

function AddTrackDialog({ sceneId, onCreated }: { sceneId: string; onCreated: () => void }) {
  const { data: songs, loading: songsLoading } = useAsync(
    () => api.songs.find({ page_size: 100 }).then(p => p.items),
    [getApiMode()],
  )
  const songItems: ComboboxItem[] = useMemo(() => {
    if (!songs) return []
    return songs.map(song => ({
      value: song.id,
      label: song.title,
      description: [userName(song.artist_id, song.artist_name), song.album, song.genre]
        .filter(Boolean)
        .join(' · '),
    }))
  }, [songs])

  const [songId, setSongId] = useState('')
  const [usageType, setUsageType] = useState<UsageType>('BACKGROUND')
  const [startTime, setStartTime] = useState('0')
  const [endTime, setEndTime] = useState('60')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedSong = songs?.find(s => s.id === songId)

  function handleSongChange(value: string) {
    setSongId(value)
    const song = songs?.find(s => s.id === value)
    if (song) {
      setStartTime('0')
      setEndTime(String(song.duration_seconds))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!songId) return
    const start = Number(startTime)
    const end = Number(endTime)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
      toast.error('End time must be greater than start time')
      return
    }
    if (selectedSong && end > selectedSong.duration_seconds) {
      toast.error(`Clip must fit within the song's duration (${formatTime(selectedSong.duration_seconds)})`)
      return
    }
    setSubmitting(true)
    try {
      await api.tracks.create({
        scene_id: sceneId,
        song_id: songId,
        usage_type: usageType,
        start_time_seconds: start,
        end_time_seconds: end,
        notes: notes || null,
      })
      toast.success('Track added')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add track')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Add track</DialogTitle>
          <DialogDescription>Place a song in this scene and set how it's used.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="track-song">Song</Label>
            <Combobox
              items={songItems}
              value={songId}
              onValueChange={handleSongChange}
              placeholder={songsLoading ? 'Loading songs...' : 'Search for a song...'}
              searchPlaceholder="Search by title, artist, album..."
              emptyMessage="No songs found."
              disabled={songsLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="track-usage">Usage type</Label>
            <Select value={usageType} onValueChange={v => setUsageType(v as UsageType)}>
              <SelectTrigger id="track-usage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USAGE_TYPES.map(u => (
                  <SelectItem key={u} value={u}>{u.charAt(0) + u.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="track-start">Start (s)</Label>
              <Input
                id="track-start"
                type="number"
                min={0}
                max={selectedSong?.duration_seconds}
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="track-end">End (s)</Label>
              <Input
                id="track-end"
                type="number"
                min={0}
                max={selectedSong?.duration_seconds}
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>
          </div>
          {selectedSong && (
            <p className="text-[12px] text-muted-foreground">
              Song duration: {formatTime(selectedSong.duration_seconds)}. The clip must fit within it.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="track-notes">Notes</Label>
            <Textarea id="track-notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting || !songId}>
            {submitting ? 'Adding...' : 'Add track'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
