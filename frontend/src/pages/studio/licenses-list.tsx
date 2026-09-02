import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { LicenseCard } from '@/components/license-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, getApiMode } from '@/api'
import { useAsync } from '@/lib/use-async'
import { FileSignature, Layers, LayoutGrid, Search } from 'lucide-react'
import type { LicenseOffer, LicenseRequest, LicenseStatus, Scene, Song, Track } from '@/types'

const STATUSES: LicenseStatus[] = ['DRAFT', 'REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED']
const STATUS_FILTERS: (LicenseStatus | 'ALL')[] = ['ALL', ...STATUSES]

type SortOption = 'updated_desc' | 'updated_asc' | 'fee_desc' | 'fee_asc'

const SORT_LABELS: Record<SortOption, string> = {
  updated_desc: 'Recently updated',
  updated_asc: 'Oldest updated',
  fee_desc: 'Highest fee',
  fee_asc: 'Lowest fee',
}

interface EnrichedLicense {
  license: LicenseRequest
  track: Track
  song?: Song
  scene?: Scene
  movieTitle?: string
  offers: LicenseOffer[]
}

/** Context-aware label for what should happen next, mirrored from the
 *  scene detail view so both surfaces describe state consistently. */
function getNextAction(license: LicenseRequest, latestOffer?: LicenseOffer): string {
  switch (license.status) {
    case 'DRAFT':
      return 'Submit for review'
    case 'REQUESTED':
      return latestOffer?.side === 'MOVIE_TEAM' ? 'Awaiting rights holder' : 'Review counter-offer'
    case 'APPROVED':
      return 'Signed — view terms'
    case 'REJECTED':
      return 'Rejected — view reason'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return 'View license'
  }
}

async function loadAllLicenses(): Promise<EnrichedLicense[]> {
  const movies = await api.movies.myMovies()
  const scenesByMovie = await Promise.all(movies.map(m => api.movies.listScenes(m.id)))
  const movieTitleByScene = new Map<string, string>()
  movies.forEach((m, i) => scenesByMovie[i].forEach(s => movieTitleByScene.set(s.id, m.title)))
  const scenes = scenesByMovie.flat()
  const tracksByScene = await Promise.all(scenes.map(s => api.scenes.listTracks(s.id)))
  const tracks = tracksByScene.flat()

  const enriched: EnrichedLicense[] = []
  await Promise.all(
    tracks.map(async track => {
      const license = await api.tracks.getLicense(track.id).catch(() => null)
      if (!license) return
      const [song, offers] = await Promise.all([
        api.songs.get(track.song_id).catch(() => undefined),
        api.licenses.listOffers(license.id).catch(() => []),
      ])
      const scene = scenes.find(s => s.id === track.scene_id)
      const movieTitle = scene ? movieTitleByScene.get(scene.id) : undefined
      enriched.push({ license, track, song, scene, movieTitle, offers })
    }),
  )
  return enriched.sort((a, b) => b.license.updated_at.localeCompare(a.license.updated_at))
}

export function StudioLicensesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize status filter from the `?status=` URL param, so links from
  // the dashboard (e.g. "3 pending") land pre-filtered.
  const initialStatus = (searchParams.get('status')?.toUpperCase() ?? 'ALL') as LicenseStatus | 'ALL'
  const [status, setStatus] = useState<LicenseStatus | 'ALL'>(
    STATUS_FILTERS.includes(initialStatus) ? initialStatus : 'ALL',
  )
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('updated_desc')
  const [grouped, setGrouped] = useState(false)

  const { data, loading, error } = useAsync(loadAllLicenses, [getApiMode()])

  function updateStatus(next: LicenseStatus | 'ALL') {
    setStatus(next)
    const params = new URLSearchParams(searchParams)
    if (next === 'ALL') params.delete('status')
    else params.set('status', next)
    setSearchParams(params, { replace: true })
  }

  const counts = useMemo(() => {
    const c: Record<LicenseStatus | 'ALL', number> = {
      ALL: data?.length ?? 0,
      DRAFT: 0,
      REQUESTED: 0,
      APPROVED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    }
    data?.forEach(item => {
      c[item.license.status] += 1
    })
    return c
  }, [data])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    let items = data ?? []
    if (status !== 'ALL') items = items.filter(item => item.license.status === status)
    if (term) {
      items = items.filter(item =>
        item.song?.title?.toLowerCase().includes(term)
        || item.movieTitle?.toLowerCase().includes(term)
        || item.scene?.title?.toLowerCase().includes(term)
        || item.license.id.toLowerCase().includes(term),
      )
    }
    const withOffer = items.map(item => ({
      item,
      latestOffer: [...item.offers].sort((a, b) => b.offer_number - a.offer_number)[0],
    }))
    withOffer.sort((a, b) => {
      switch (sort) {
        case 'updated_asc':
          return a.item.license.updated_at.localeCompare(b.item.license.updated_at)
        case 'fee_desc':
          return (b.latestOffer?.license_fee ?? -Infinity) - (a.latestOffer?.license_fee ?? -Infinity)
        case 'fee_asc':
          return (a.latestOffer?.license_fee ?? Infinity) - (b.latestOffer?.license_fee ?? Infinity)
        case 'updated_desc':
        default:
          return b.item.license.updated_at.localeCompare(a.item.license.updated_at)
      }
    })
    return withOffer
  }, [data, status, search, sort])

  function renderCard({ item, latestOffer }: { item: EnrichedLicense; latestOffer?: LicenseOffer }) {
    return (
      <LicenseCard
        key={item.license.id}
        license={item.license}
        latestOffer={latestOffer}
        offerCount={item.offers.length}
        songTitle={item.song?.title}
        sceneTitle={item.scene?.title}
        movieTitle={item.movieTitle}
        nextAction={getNextAction(item.license, latestOffer)}
        onClick={() => navigate(`/studio/licenses/${item.license.id}`)}
      />
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Licenses"
        description="All license requests across your movies."
        actions={
          <div className="flex items-center gap-2">
            <Select value={sort} onValueChange={v => setSort(v as SortOption)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortOption[]).map(key => (
                  <SelectItem key={key} value={key}>{SORT_LABELS[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={grouped ? 'default' : 'outline'}
              size="icon"
              aria-pressed={grouped}
              aria-label={grouped ? 'Switch to flat list' : 'Group by status'}
              onClick={() => setGrouped(g => !g)}
            >
              {grouped ? <Layers /> : <LayoutGrid />}
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by song, movie, scene, or license ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(s => (
          <button key={s} type="button" onClick={() => updateStatus(s)}>
            <Badge
              variant={status === s ? 'default' : 'outline'}
              className={cn('cursor-pointer text-[11px]', status === s && 'ring-1 ring-ring')}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              <span className="ml-1 tabular-nums opacity-75">{counts[s]}</span>
            </Badge>
          </button>
        ))}
      </div>

      {error && <EmptyState title="Couldn't load licenses" description={error.message} />}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : filtered.length > 0 ? (
        grouped ? (
          <div className="space-y-8">
            {STATUSES.filter(s => filtered.some(f => f.item.license.status === s)).map(s => {
              const items = filtered.filter(f => f.item.license.status === s)
              return (
                <div key={s} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">{s.charAt(0) + s.slice(1).toLowerCase()}</h2>
                    <span className="text-[12px] text-muted-foreground tabular-nums">{items.length}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(renderCard)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(renderCard)}
          </div>
        )
      ) : (
        <EmptyState
          icon={<FileSignature className="size-5" />}
          title="No license requests"
          description={
            search
              ? `No requests matching "${search}".`
              : status === 'ALL'
                ? 'Request a license from a scene to get started.'
                : `No requests with status "${status}".`
          }
        />
      )}
    </div>
  )
}
