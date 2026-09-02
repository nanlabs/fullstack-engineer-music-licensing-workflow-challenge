import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getApiMode } from '@/api'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { SongCard } from '@/components/song-card'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxItem } from '@/components/ui/combobox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/lib/use-async'
import { loadRightsSongs } from '@/lib/rights-data'
import { useRightsPersona } from '@/lib/rights-persona'
import { userName } from '@/lib/user-name'
import { Disc3, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

export function RightsCatalogPage() {
  const persona = useRightsPersona()
  const { data: songs, loading, error, reload } = useAsync(
    () => loadRightsSongs(persona),
    [persona.id, persona.labelId, persona.user.id, getApiMode()],
  )
  const [query, setQuery] = useState('')
  const visibleSongs = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return songs ?? []
    return (songs ?? []).filter(song => [song.title, song.album, song.genre, song.isrc]
      .some(value => value?.toLowerCase().includes(normalized)))
  }, [query, songs])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Catalog"
        description={persona.kind === 'independent'
          ? 'Songs you own and license directly.'
          : persona.catalogScope === 'artist'
            ? `Your songs represented by ${persona.labelName}.`
            : `All songs represented by ${persona.labelName}.`}
        actions={<AddSongDialog persona={persona} onCreated={reload} />}
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, album, genre, or ISRC" className="pl-9" />
      </div>

      {error ? (
        <EmptyState title="Catalog unavailable" description={error.message} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
      ) : visibleSongs.length === 0 ? (
        <EmptyState icon={<Disc3 />} title={query ? 'No matching songs' : 'No songs yet'} description={query ? 'Try a different search.' : 'Add the first song to this catalog.'} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSongs.map(song => (
            <Link key={song.id} to={`/rights/catalog/${song.id}`} className="block">
              <SongCard
                song={song}
                artistName={userName(song.artist_id, song.artist_name)}
                labelName={persona.labelName ?? 'Independent'}
                className="h-full hover:border-primary/35"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function AddSongDialog({ persona, onCreated }: { persona: ReturnType<typeof useRightsPersona>; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [artistId, setArtistId] = useState(persona.user.id)
  const [album, setAlbum] = useState('')
  const [genre, setGenre] = useState('')
  const [isrc, setIsrc] = useState('')
  const [duration, setDuration] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load label artists for the artist picker
  const { data: members } = useAsync(
    () => persona.labelId ? api.labels.listMembers(persona.labelId) : Promise.resolve([]),
    [persona.labelId, getApiMode()],
  )
  const artistItems: ComboboxItem[] = useMemo(() => {
    if (!members) return []
    return members
      .filter(m => m.role === 'ARTIST')
      .map(m => ({ value: m.user_id, label: userName(m.user_id, m.user_name), description: m.role }))
  }, [members])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await api.songs.create({
        title,
        artist_id: persona.catalogScope === 'artist' ? persona.user.id : artistId,
        label_id: persona.labelId,
        album: album || null,
        duration_seconds: Number(duration),
        genre: genre || null,
        isrc: isrc || null,
      })
      toast.success('Song added to catalog')
      setOpen(false)
      setTitle('')
      setAlbum('')
      setGenre('')
      setIsrc('')
      setDuration('')
      onCreated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add song')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus /> Add song</Button>} />
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add song</DialogTitle>
            <DialogDescription>{persona.kind === 'independent' ? 'This song will be owned and licensed directly by you.' : `Add a song to ${persona.labelName}.`}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <Field label="Title" id="song-title"><Input id="song-title" value={title} onChange={event => setTitle(event.target.value)} autoFocus required /></Field>
            <Field label="Duration (seconds)" id="song-duration"><Input id="song-duration" type="number" min="1" value={duration} onChange={event => setDuration(event.target.value)} required /></Field>
            {persona.catalogScope === 'label' && (
              <Field label="Artist" id="song-artist">
                <Combobox
                  items={artistItems}
                  value={artistId}
                  onValueChange={setArtistId}
                  placeholder="Select artist..."
                  searchPlaceholder="Search artists..."
                  emptyMessage="No artists found in this label."
                />
              </Field>
            )}
            <Field label="Album" id="song-album"><Input id="song-album" value={album} onChange={event => setAlbum(event.target.value)} /></Field>
            <Field label="Genre" id="song-genre"><Input id="song-genre" value={genre} onChange={event => setGenre(event.target.value)} /></Field>
            <Field label="ISRC" id="song-isrc"><Input id="song-isrc" value={isrc} onChange={event => setIsrc(event.target.value)} /></Field>
          </div>
          <DialogFooter><Button type="submit" disabled={submitting || !title.trim() || (persona.catalogScope === 'label' && !artistId)}>{submitting ? 'Adding...' : 'Add song'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>
}
