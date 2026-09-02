import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { MovieCard } from '@/components/movie-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { api, getApiMode } from '@/api'
import { useAsync } from '@/lib/use-async'
import { Clapperboard, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { LicenseRequest, Movie, Scene, Track } from '@/types'

type SortKey = 'recent' | 'title' | 'tracks' | 'progress'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Recently created' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'tracks', label: 'Most tracks' },
  { value: 'progress', label: 'Licensing progress' },
]

interface EnrichedMovie {
  movie: Movie
  sceneCount: number
  trackCount: number
  licensedCount: number
}

async function loadMovies(): Promise<EnrichedMovie[]> {
  const movies = await api.movies.myMovies()
  return Promise.all(
    movies.map(async movie => {
      const scenes = await api.movies.listScenes(movie.id)
      const trackLists = await Promise.all(scenes.map((scene: Scene) => api.scenes.listTracks(scene.id)))
      const tracks = trackLists.flat() as Track[]
      const licenses = await Promise.all(
        tracks.map(track => api.tracks.getLicense(track.id).catch(() => null)),
      )
      const licensedCount = licenses.filter(
        (l): l is LicenseRequest => l != null && l.status === 'APPROVED',
      ).length
      return { movie, sceneCount: scenes.length, trackCount: tracks.length, licensedCount }
    }),
  )
}

export function StudioMoviesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [createOpen, setCreateOpen] = useState(false)
  const { data: movies, loading, error, reload } = useAsync(loadMovies, [getApiMode()])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const list = (movies ?? []).filter(({ movie }) => {
      if (!query) return true
      return (
        movie.title.toLowerCase().includes(query) ||
        (movie.director?.toLowerCase().includes(query) ?? false)
      )
    })
    const sorted = [...list]
    switch (sort) {
      case 'title':
        sorted.sort((a, b) => a.movie.title.localeCompare(b.movie.title))
        break
      case 'tracks':
        sorted.sort((a, b) => b.trackCount - a.trackCount)
        break
      case 'progress': {
        const progress = (m: EnrichedMovie) => (m.trackCount ? m.licensedCount / m.trackCount : 0)
        sorted.sort((a, b) => progress(b) - progress(a))
        break
      }
      case 'recent':
      default:
        sorted.sort((a, b) => b.movie.created_at.localeCompare(a.movie.created_at))
        break
    }
    return sorted
  }, [movies, search, sort])

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Movies"
        description="Movies your studio is producing music for."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button size="sm">New Movie</Button>} />
            <CreateMovieDialog
              onCreated={() => {
                setCreateOpen(false)
                reload()
              }}
            />
          </Dialog>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by title or director..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={sort} onValueChange={v => setSort((v as SortKey) ?? 'recent')}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <EmptyState title="Couldn't load movies" description={error.message} />}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(({ movie, sceneCount, trackCount, licensedCount }) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              sceneCount={sceneCount}
              trackCount={trackCount}
              licensedCount={licensedCount}
              onClick={() => navigate(`/studio/movies/${movie.id}`)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Clapperboard className="size-5" />}
          title={search ? 'No matching movies' : 'No movies yet'}
          description={search ? 'Try a different search term.' : 'Create your first movie to get started.'}
          action={search ? undefined : { label: 'New Movie', onClick: () => setCreateOpen(true) }}
        />
      )}
    </div>
  )
}

function CreateMovieDialog({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [director, setDirector] = useState('')
  const [releaseYear, setReleaseYear] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await api.movies.create({
        title,
        director: director || null,
        release_year: releaseYear ? Number(releaseYear) : null,
        description: description || null,
      })
      toast.success('Movie created')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create movie')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>New movie</DialogTitle>
          <DialogDescription>Add a movie to start placing tracks and requesting licenses.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="movie-title">Title</Label>
            <Input id="movie-title" value={title} onChange={e => setTitle(e.target.value)} autoFocus required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="movie-director">Director</Label>
              <Input id="movie-director" value={director} onChange={e => setDirector(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="movie-year">Release year</Label>
              <Input
                id="movie-year"
                type="number"
                value={releaseYear}
                onChange={e => setReleaseYear(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="movie-description">Description</Label>
            <Textarea id="movie-description" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting || !title.trim()}>
            {submitting ? 'Creating...' : 'Create movie'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
