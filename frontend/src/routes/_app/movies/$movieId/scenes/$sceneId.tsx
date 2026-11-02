import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ListMusicIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { z } from "zod"

import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { DeleteSceneDialog } from "@/components/scenes/delete-scene-dialog"
import { SceneSheet } from "@/components/scenes/scene-sheet"
import { CueTimeline } from "@/components/tracks/cue-timeline"
import { DeleteTrackDialog } from "@/components/tracks/delete-track-dialog"
import { TrackSheet } from "@/components/tracks/track-sheet"
import { TrackTable } from "@/components/tracks/track-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LICENSE_STATES, type LicenseState, type Track } from "@/lib/api/types"
import { useCan } from "@/lib/auth/use-can"
import { LICENSE_STATE_LABEL } from "@/lib/format/labels"
import { formatTimecode } from "@/lib/format/timecode"
import { movieQueries } from "@/lib/queries/movies"
import { sceneQueries } from "@/lib/queries/scenes"
import { trackQueries } from "@/lib/queries/tracks"

const searchSchema = z.object({
  state: z.enum(LICENSE_STATES).optional(),
})

export const Route = createFileRoute("/_app/movies/$movieId/scenes/$sceneId")({
  validateSearch: searchSchema,
  loader: ({ context: { queryClient }, params: { movieId, sceneId } }) =>
    Promise.all([
      queryClient.ensureQueryData(movieQueries.detail(movieId)),
      queryClient.ensureQueryData(sceneQueries.detail(sceneId)),
      queryClient.ensureQueryData(trackQueries.byScene(sceneId)),
    ]),
  component: ScenePage,
})

function ScenePage() {
  const { movieId, sceneId } = Route.useParams()
  const { state } = Route.useSearch()
  const navigate = Route.useNavigate()
  const goTo = useNavigate()
  const { data: movie } = useSuspenseQuery(movieQueries.detail(movieId))
  const { data: scene } = useSuspenseQuery(sceneQueries.detail(sceneId))
  const { data: tracks } = useSuspenseQuery(trackQueries.byScene(sceneId))
  const canWrite = useCan("movies:write")

  const [editingScene, setEditingScene] = useState(false)
  const [deletingScene, setDeletingScene] = useState(false)
  const [trackSheet, setTrackSheet] = useState<{
    open: boolean
    track?: Track
  }>({ open: false })
  const [deletingTrack, setDeletingTrack] = useState<Track | null>(null)

  const visible = state
    ? tracks.items.filter((t) => t.license.state === state)
    : tracks.items
  const window =
    scene.start_ms !== null && scene.end_ms !== null
      ? `${formatTimecode(scene.start_ms)} – ${formatTimecode(scene.end_ms)}`
      : null

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Películas", to: "/movies" },
          { label: movie.title, to: "/movies/$movieId", params: { movieId } },
          { label: scene.title },
        ]}
        title={scene.title}
        meta={
          <span className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Escena {scene.position}</span>
            <span className="timecode">{window ?? "Sin ventana"}</span>
          </span>
        }
        description={scene.description ?? undefined}
        actions={
          canWrite ? (
            <>
              <Button onClick={() => setTrackSheet({ open: true })}>
                <PlusIcon data-icon="inline-start" /> Añadir cue
              </Button>
              <Button variant="outline" onClick={() => setEditingScene(true)}>
                <PencilIcon data-icon="inline-start" /> Editar escena
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Más acciones"
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeletingScene(true)}
                  >
                    <Trash2Icon /> Eliminar escena
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null
        }
      />

      {tracks.count === 0 ? (
        <EmptyState
          icon={<ListMusicIcon />}
          title="Esta escena no tiene cues."
          description={
            canWrite
              ? "Añade el primero: una canción, su uso y el tramo de la película donde suena."
              : "Cuando se añadan cues aparecerán aquí con su licencia."
          }
          action={
            canWrite ? (
              <Button onClick={() => setTrackSheet({ open: true })}>
                <PlusIcon data-icon="inline-start" /> Añadir cue
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          <CueTimeline scene={scene} tracks={tracks.items} />
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold">Cues</h2>
            <Select
              value={state ?? "all"}
              onValueChange={(value) =>
                void navigate({
                  search:
                    value === "all" ? {} : { state: value as LicenseState },
                  replace: true,
                })
              }
            >
              <SelectTrigger
                className="w-48"
                aria-label="Filtrar por estado de licencia"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las licencias</SelectItem>
                {LICENSE_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LICENSE_STATE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {visible.length === 0 && state ? (
            <EmptyState
              title={`Ningún cue con licencia ${LICENSE_STATE_LABEL[state].toLowerCase()}.`}
            />
          ) : (
            <TrackTable
              tracks={visible}
              canWrite={canWrite}
              onEdit={(track) => setTrackSheet({ open: true, track })}
              onDelete={setDeletingTrack}
            />
          )}
        </div>
      )}

      <SceneSheet
        movieId={movieId}
        open={editingScene}
        onOpenChange={setEditingScene}
        scene={scene}
      />
      <DeleteSceneDialog
        movieId={movieId}
        scene={deletingScene ? scene : null}
        onOpenChange={setDeletingScene}
        onDeleted={() =>
          void goTo({ to: "/movies/$movieId", params: { movieId } })
        }
      />
      <TrackSheet
        scene={scene}
        open={trackSheet.open}
        track={trackSheet.track}
        onOpenChange={(open) => setTrackSheet((s) => ({ ...s, open }))}
      />
      <DeleteTrackDialog
        track={deletingTrack}
        onOpenChange={(open) => !open && setDeletingTrack(null)}
      />
    </>
  )
}
