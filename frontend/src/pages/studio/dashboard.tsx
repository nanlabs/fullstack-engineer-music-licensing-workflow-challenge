import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { MovieCard } from '@/components/movie-card'
import { LicenseCard } from '@/components/license-card'
import { UserAvatar } from '@/components/user-avatar'
import { cn, formatRelativeTime } from '@/lib/utils'
import { userName } from '@/lib/user-name'
import { api, getApiMode } from '@/api'
import { useAsync } from '@/lib/use-async'
import { Clapperboard, FileSignature, Hourglass, CircleCheck, FileEdit, Activity } from 'lucide-react'
import type { LicenseOffer, LicenseRequest, LicenseStatus, Movie, Scene, Song, Track } from '@/types'

interface EnrichedLicense {
  license: LicenseRequest
  track: Track
  scene?: Scene
  song?: Song
  movie?: Movie
  offers: LicenseOffer[]
}

interface DashboardData {
  movies: Movie[]
  scenesByMovie: Record<string, Scene[]>
  tracks: Track[]
  licenses: EnrichedLicense[]
}

async function loadDashboard(): Promise<DashboardData> {
  const movies = await api.movies.myMovies()
  const scenesByMovie: Record<string, Scene[]> = {}
  await Promise.all(
    movies.map(async movie => {
      scenesByMovie[movie.id] = await api.movies.listScenes(movie.id)
    }),
  )
  const allScenes = Object.values(scenesByMovie).flat()
  const trackLists = await Promise.all(allScenes.map(scene => api.scenes.listTracks(scene.id)))
  const tracks = trackLists.flat()

  const movieById = new Map(movies.map(m => [m.id, m]))
  const sceneById = new Map(allScenes.map(s => [s.id, s]))
  const songCache = new Map<string, Song>()

  const licenses: EnrichedLicense[] = []
  await Promise.all(
    tracks.map(async track => {
      const license = await api.tracks.getLicense(track.id).catch(() => null)
      if (!license) return
      let song = songCache.get(track.song_id)
      if (!song) {
        song = await api.songs.get(track.song_id).catch(() => undefined)
        if (song) songCache.set(track.song_id, song)
      }
      const scene = sceneById.get(track.scene_id)
      const movie = scene ? movieById.get(scene.movie_id) : undefined
      const offers = await api.licenses.listOffers(license.id).catch(() => [])
      licenses.push({ license, track, scene, song, movie, offers })
    }),
  )

  return { movies, scenesByMovie, tracks, licenses }
}

function StatCard({
  label,
  value,
  icon,
  onClick,
}: {
  label: string
  value: number
  icon: React.ReactNode
  onClick?: () => void
}) {
  return (
    <Card
      className={cn(
        'transition-all',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      onClick={onClick}
      onKeyDown={event => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) onClick()
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <CardContent className="flex items-center justify-between py-4">
        <div>
          <p className="text-[12px] text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums mt-0.5">{value}</p>
        </div>
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}

export function StudioDashboardPage() {
  const navigate = useNavigate()
  const { data, loading, error } = useAsync(loadDashboard, [getApiMode()])

  const countByStatus = (status: LicenseStatus) =>
    data?.licenses.filter(l => l.license.status === status).length ?? 0

  const pending = countByStatus('REQUESTED')
  const drafts = countByStatus('DRAFT')
  const approved = countByStatus('APPROVED')

  const attention = data?.licenses
    .filter(l => l.license.status === 'REQUESTED' || l.license.status === 'DRAFT')
    .sort((a, b) => b.license.updated_at.localeCompare(a.license.updated_at)) ?? []

  const recentActivity = data?.licenses
    .slice()
    .sort((a, b) => b.license.updated_at.localeCompare(a.license.updated_at))
    .slice(0, 6) ?? []

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="Studio Dashboard"
        description="Overview of your movies and license negotiations."
        actions={<Button size="sm" onClick={() => navigate('/studio/movies')}>New Movie</Button>}
      />

      {error && (
        <EmptyState title="Couldn't load dashboard" description={error.message} />
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Movies"
            value={data?.movies.length ?? 0}
            icon={<Clapperboard className="size-4" />}
            onClick={() => navigate('/studio/movies')}
          />
          <StatCard
            label="Tracks placed"
            value={data?.tracks.length ?? 0}
            icon={<FileSignature className="size-4" />}
            onClick={() => navigate('/studio/movies')}
          />
          <StatCard
            label="Pending negotiation"
            value={pending}
            icon={<Hourglass className="size-4" />}
            onClick={() => navigate('/studio/licenses')}
          />
          <StatCard
            label="Drafts"
            value={drafts}
            icon={<FileEdit className="size-4" />}
            onClick={() => navigate('/studio/licenses')}
          />
          <StatCard
            label="Approved"
            value={approved}
            icon={<CircleCheck className="size-4" />}
            onClick={() => navigate('/studio/licenses')}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your movies</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/studio/movies')}>
              View all
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : data && data.movies.length > 0 ? (
            <div className="space-y-3">
              {data.movies.slice(0, 3).map(movie => {
                const scenes = data.scenesByMovie[movie.id] ?? []
                const movieTracks = data.tracks.filter(t => scenes.some(s => s.id === t.scene_id))
                const licensedCount = data.licenses.filter(
                  l => l.movie?.id === movie.id && l.license.status === 'APPROVED',
                ).length
                return (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    sceneCount={scenes.length}
                    trackCount={movieTracks.length}
                    licensedCount={licensedCount}
                    onClick={() => navigate(`/studio/movies/${movie.id}`)}
                  />
                )
              })}
            </div>
          ) : (
            <Card><CardContent className="py-10">
              <EmptyState
                icon={<Clapperboard className="size-5" />}
                title="No movies yet"
                description="Create your first movie to start placing tracks and requesting licenses."
                action={{ label: 'New Movie', onClick: () => navigate('/studio/movies') }}
              />
            </CardContent></Card>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Needs attention</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/studio/licenses')}>
              View all
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : attention.length > 0 ? (
            <div className="space-y-3">
              {attention.slice(0, 3).map(item => {
                const latestOffer = [...item.offers].sort((a, b) => b.offer_number - a.offer_number)[0]
                const nextAction = item.license.status === 'DRAFT'
                  ? 'Send to rights holder'
                  : latestOffer?.side === 'RIGHTS_HOLDER'
                    ? 'Review counter-offer'
                    : 'Awaiting rights holder'
                return (
                  <LicenseCard
                    key={item.license.id}
                    license={item.license}
                    latestOffer={latestOffer}
                    offerCount={item.offers.length}
                    songTitle={item.song?.title}
                    sceneTitle={item.scene?.title}
                    movieTitle={item.movie?.title}
                    nextAction={nextAction}
                    onClick={() => navigate(`/studio/licenses/${item.license.id}`)}
                  />
                )
              })}
            </div>
          ) : (
            <Card><CardContent className="py-10">
              <EmptyState
                icon={<FileSignature className="size-5" />}
                title="All caught up"
                description="No license requests are waiting on you right now."
              />
            </CardContent></Card>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent activity</h2>
        </div>
        {loading ? (
          <Skeleton className="h-48" />
        ) : recentActivity.length > 0 ? (
          <Card>
            <CardContent className="divide-y divide-border py-0">
              {recentActivity.map(item => {
                const actorId = item.license.resolved_by ?? item.license.requested_by
                const actorName = item.license.resolved_by
                  ? item.license.resolved_by_name
                  : item.license.requested_by_name
                const verb = item.license.status === 'APPROVED'
                  ? 'approved'
                  : item.license.status === 'REJECTED'
                    ? 'rejected'
                    : item.license.status === 'REQUESTED'
                      ? 'requested'
                      : 'drafted'
                return (
                  <div
                    key={item.license.id}
                    className="flex items-center gap-3 py-3 cursor-pointer"
                    onClick={() => navigate(`/studio/licenses/${item.license.id}`)}
                  >
                    <UserAvatar name={userName(actorId, actorName)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] truncate">
                        <span className="font-medium">{userName(actorId, actorName)}</span>{' '}
                        {verb} the license for{' '}
                        <span className="font-medium">{item.song?.title ?? 'a track'}</span>
                        {item.movie ? ` in "${item.movie.title}"` : ''}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatRelativeTime(item.license.updated_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="py-10">
            <EmptyState
              icon={<Activity className="size-5" />}
              title="No activity yet"
              description="License activity across your movies will show up here."
            />
          </CardContent></Card>
        )}
      </section>
    </div>
  )
}
