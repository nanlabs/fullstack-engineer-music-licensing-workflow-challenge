import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { EmptyState } from '@/components/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { MovieRoleBadge } from '@/components/role-badge'
import { UserAvatarWithInfo } from '@/components/user-avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, getApiMode } from '@/api'
import { useAsync } from '@/lib/use-async'
import { userName } from '@/lib/user-name'
import { cn, formatTime } from '@/lib/utils'
import { Clapperboard, Film, Users, Plus, Search, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { LicenseRequest, LicenseStatus, MovieMember, MovieRole, Scene, Track } from '@/types'

type SceneSortKey = 'number' | 'title' | 'duration' | 'tracks'

const SCENE_SORT_OPTIONS: { value: SceneSortKey; label: string }[] = [
  { value: 'number', label: 'Scene order' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'duration', label: 'Duration' },
  { value: 'tracks', label: 'Most tracks' },
]

const ROLE_TITLE: Record<MovieRole, string> = {
  OWNER: 'Owner',
  SUPERVISOR: 'Music Supervisor',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
}

interface MovieDetailData {
  scenes: Scene[]
  tracksByScene: Record<string, Track[]>
  licenseByTrack: Record<string, LicenseRequest | null>
  members: MovieMember[]
}

async function loadMovieDetail(movieId: string): Promise<MovieDetailData> {
  const [scenes, members] = await Promise.all([
    api.movies.listScenes(movieId),
    api.movies.listMembers(movieId),
  ])
  const tracksByScene: Record<string, Track[]> = {}
  await Promise.all(
    scenes.map(async scene => {
      tracksByScene[scene.id] = await api.scenes.listTracks(scene.id)
    }),
  )
  const allTracks = Object.values(tracksByScene).flat()
  const licenseByTrack: Record<string, LicenseRequest | null> = {}
  await Promise.all(
    allTracks.map(async track => {
      licenseByTrack[track.id] = await api.tracks.getLicense(track.id).catch(() => null)
    }),
  )
  return { scenes, tracksByScene, licenseByTrack, members }
}

export function StudioMovieDetailPage() {
  const { movieId = '' } = useParams()
  const navigate = useNavigate()
  const [createSceneOpen, setCreateSceneOpen] = useState(false)
  const [sceneSearch, setSceneSearch] = useState('')
  const [sceneSort, setSceneSort] = useState<SceneSortKey>('number')

  const { data: movie, loading: movieLoading, error: movieError } = useAsync(
    () => api.movies.get(movieId),
    [movieId, getApiMode()],
  )
  const { data, loading, error, reload } = useAsync(
    () => loadMovieDetail(movieId),
    [movieId, getApiMode()],
  )

  const allTracks = useMemo(() => Object.values(data?.tracksByScene ?? {}).flat(), [data])
  const licensedCount = useMemo(
    () => allTracks.filter(t => data?.licenseByTrack[t.id]?.status === 'APPROVED').length,
    [allTracks, data],
  )
  const progress = allTracks.length ? Math.round((licensedCount / allTracks.length) * 100) : 0

  const visibleScenes = useMemo(() => {
    const query = sceneSearch.trim().toLowerCase()
    const scenes = (data?.scenes ?? []).filter(scene => {
      if (!query) return true
      return scene.title.toLowerCase().includes(query) || (scene.description?.toLowerCase().includes(query) ?? false)
    })
    const sorted = [...scenes]
    switch (sceneSort) {
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'duration':
        sorted.sort((a, b) => b.duration_seconds - a.duration_seconds)
        break
      case 'tracks':
        sorted.sort((a, b) => (data?.tracksByScene[b.id]?.length ?? 0) - (data?.tracksByScene[a.id]?.length ?? 0))
        break
      case 'number':
      default:
        sorted.sort((a, b) => a.scene_number - b.scene_number)
        break
    }
    return sorted
  }, [data, sceneSearch, sceneSort])

  if (movieError) {
    return <EmptyState title="Movie not found" description={movieError.message} />
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <Breadcrumbs
        items={[
          { label: 'Movies', href: '/studio/movies' },
          { label: movieLoading ? 'Loading...' : movie?.title ?? 'Movie' },
        ]}
      />

      <PageHeader
        title={movieLoading ? 'Loading...' : movie?.title ?? 'Movie'}
        description={movie?.director ? `Directed by ${movie.director}` : undefined}
        actions={
          <Dialog open={createSceneOpen} onOpenChange={setCreateSceneOpen}>
            <DialogTrigger render={<Button size="sm"><Plus /> New Scene</Button>} />
            <CreateSceneDialog
              movieId={movieId}
              nextSceneNumber={(data?.scenes.length ?? 0) + 1}
              onCreated={() => {
                setCreateSceneOpen(false)
                reload()
              }}
            />
          </Dialog>
        }
      />

      {!movieLoading && movie && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 py-4">
            <div>
              <p className="text-[11px] text-muted-foreground">Release year</p>
              <p className="text-sm font-medium">{movie.release_year ?? 'TBD'}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Scenes</p>
              <p className="text-sm font-medium tabular-nums">{data?.scenes.length ?? 0}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Tracks placed</p>
              <p className="text-sm font-medium tabular-nums">{allTracks.length}</p>
            </div>
            <div className="min-w-[180px] flex-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Licensing progress</span>
                <span className="tabular-nums">{progress}% ({licensedCount}/{allTracks.length})</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="scenes">
        <TabsList>
          <TabsTrigger value="scenes"><Film /> Scenes</TabsTrigger>
          <TabsTrigger value="team"><Users /> Team</TabsTrigger>
        </TabsList>

        <TabsContent value="scenes" className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search scenes..."
                value={sceneSearch}
                onChange={e => setSceneSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={sceneSort} onValueChange={v => setSceneSort((v as SceneSortKey) ?? 'number')}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENE_SORT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <EmptyState title="Couldn't load scenes" description={error.message} />}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : visibleScenes.length > 0 ? (
            visibleScenes.map(scene => (
              <SceneRow
                key={scene.id}
                scene={scene}
                tracks={data?.tracksByScene[scene.id] ?? []}
                licenseByTrack={data?.licenseByTrack ?? {}}
                onClick={() => navigate(`/studio/movies/${movieId}/scenes/${scene.id}`)}
              />
            ))
          ) : data && data.scenes.length > 0 ? (
            <EmptyState
              icon={<Search className="size-5" />}
              title="No matching scenes"
              description="Try a different search term."
            />
          ) : (
            <EmptyState
              icon={<Clapperboard className="size-5" />}
              title="No scenes yet"
              description="Add a scene to start placing music."
              action={{ label: 'New Scene', onClick: () => setCreateSceneOpen(true) }}
            />
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-3 pt-4">
          {loading ? (
            <Skeleton className="h-32" />
          ) : data && data.members.length > 0 ? (
            <Card>
              <CardContent className="divide-y divide-border py-0">
                {data.members.map(member => (
                  <div key={member.user_id} className="flex items-center justify-between py-3">
                    <UserAvatarWithInfo name={userName(member.user_id, member.user_name)} subtitle={ROLE_TITLE[member.role]} />
                    <MovieRoleBadge role={member.role} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={<Users className="size-5" />}
              title="No team members yet"
              description="Add collaborators to this movie to manage access."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SceneRow({
  scene,
  tracks,
  licenseByTrack,
  onClick,
}: {
  scene: Scene
  tracks: Track[]
  licenseByTrack: Record<string, LicenseRequest | null>
  onClick: () => void
}) {
  const statuses = tracks.map(t => licenseByTrack[t.id]?.status).filter(Boolean) as LicenseStatus[]

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      onClick={onClick}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') onClick()
      }}
      role="button"
      tabIndex={0}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] font-mono">#{scene.scene_number}</Badge>
              <CardTitle className="text-sm font-semibold truncate">{scene.title}</CardTitle>
            </div>
            {scene.description && (
              <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">{scene.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formatTime(scene.duration_seconds)}
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex items-center gap-2 flex-wrap pt-0">
        <Badge variant="secondary" className="text-[11px]">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''}
        </Badge>
        {statuses.map((status, i) => <StatusBadge key={i} status={status} />)}
      </CardContent>
    </Card>
  )
}

function CreateSceneDialog({
  movieId,
  nextSceneNumber,
  onCreated,
}: {
  movieId: string
  nextSceneNumber: number
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [sceneNumber, setSceneNumber] = useState(String(nextSceneNumber))
  const [startTime, setStartTime] = useState('0')
  const [endTime, setEndTime] = useState('60')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await api.scenes.create({
        movie_id: movieId,
        title,
        scene_number: Number(sceneNumber),
        start_time: Number(startTime),
        end_time: Number(endTime),
        description: description || null,
      })
      toast.success('Scene created')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create scene')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>New scene</DialogTitle>
          <DialogDescription>Define a scene's time range before placing tracks in it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="scene-title">Title</Label>
            <Input id="scene-title" value={title} onChange={e => setTitle(e.target.value)} autoFocus required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="scene-number">Scene #</Label>
              <Input id="scene-number" type="number" value={sceneNumber} onChange={e => setSceneNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scene-start">Start (s)</Label>
              <Input id="scene-start" type="number" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scene-end">End (s)</Label>
              <Input id="scene-end" type="number" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scene-description">Description</Label>
            <Textarea id="scene-description" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting || !title.trim()}>
            {submitting ? 'Creating...' : 'Create scene'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
