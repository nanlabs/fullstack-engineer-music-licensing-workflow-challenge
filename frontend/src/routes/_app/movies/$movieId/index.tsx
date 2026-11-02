import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ClapperboardIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/layout/empty-state"
import { LiveFeed } from "@/components/licenses/live-feed"
import { PageHeader } from "@/components/layout/page-header"
import { DeleteMovieDialog } from "@/components/movies/delete-movie-dialog"
import { MovieDialog } from "@/components/movies/movie-dialog"
import { MovieStatusBadge } from "@/components/movies/movie-status-badge"
import { DeleteSceneDialog } from "@/components/scenes/delete-scene-dialog"
import { SceneBoard } from "@/components/scenes/scene-board"
import { SceneSheet } from "@/components/scenes/scene-sheet"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { describeError } from "@/lib/api/errors"
import type { Scene } from "@/lib/api/types"
import { useCan } from "@/lib/auth/use-can"
import { movieQueries } from "@/lib/queries/movies"
import { sceneQueries, useReorderScenes } from "@/lib/queries/scenes"
import { trackQueries } from "@/lib/queries/tracks"

export const Route = createFileRoute("/_app/movies/$movieId/")({
  loader: ({ context: { queryClient }, params: { movieId } }) =>
    Promise.all([
      queryClient.ensureQueryData(movieQueries.detail(movieId)),
      queryClient.ensureQueryData(sceneQueries.byMovie(movieId)),
      queryClient.ensureQueryData(trackQueries.byMovie(movieId)),
    ]),
  component: MoviePage,
})

function MoviePage() {
  const { movieId } = Route.useParams()
  const navigate = useNavigate()
  const { data: movie } = useSuspenseQuery(movieQueries.detail(movieId))
  const { data: scenes } = useSuspenseQuery(sceneQueries.byMovie(movieId))
  const { data: tracks } = useSuspenseQuery(trackQueries.byMovie(movieId))
  const canWrite = useCan("movies:write")
  const reorder = useReorderScenes(movieId)

  const [editingMovie, setEditingMovie] = useState(false)
  const [deletingMovie, setDeletingMovie] = useState(false)
  const [sceneSheet, setSceneSheet] = useState<{
    open: boolean
    scene?: Scene
  }>({ open: false })
  const [deletingScene, setDeletingScene] = useState<Scene | null>(null)

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Películas", to: "/movies" }, { label: movie.title }]}
        title={movie.title}
        meta={
          <span className="flex items-center gap-2">
            <MovieStatusBadge status={movie.status} />
            {movie.release_year ? (
              <span className="text-sm text-muted-foreground">
                {movie.release_year}
              </span>
            ) : null}
          </span>
        }
        description={movie.synopsis ?? undefined}
        actions={
          canWrite ? (
            <>
              <Button onClick={() => setSceneSheet({ open: true })}>
                <PlusIcon data-icon="inline-start" /> Nueva escena
              </Button>
              <Button variant="outline" onClick={() => setEditingMovie(true)}>
                <PencilIcon data-icon="inline-start" /> Editar
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
                    onSelect={() => setDeletingMovie(true)}
                  >
                    <Trash2Icon /> Eliminar película
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null
        }
      />

      {scenes.count === 0 ? (
        <EmptyState
          icon={<ClapperboardIcon />}
          title="Esta película no tiene escenas."
          description={
            canWrite
              ? "Crea la primera; después añade en cada escena los cues que necesitan licencia."
              : "Cuando se añadan escenas aparecerán aquí con sus cues."
          }
          action={
            canWrite ? (
              <Button onClick={() => setSceneSheet({ open: true })}>
                <PlusIcon data-icon="inline-start" /> Nueva escena
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          <SceneBoard
            scenes={scenes.items}
            tracks={tracks.items}
            canWrite={canWrite}
            reordering={reorder.isPending}
            onEdit={(scene) => setSceneSheet({ open: true, scene })}
            onDelete={setDeletingScene}
            onReorder={(ids) =>
              reorder.mutate(ids, {
                onError: (error) => {
                  const text = describeError(error)
                  toast.error(text.title, { description: text.description })
                },
              })
            }
          />
          <LiveFeed movieId={movieId} />
        </div>
      )}

      <MovieDialog
        open={editingMovie}
        onOpenChange={setEditingMovie}
        movie={movie}
      />
      <DeleteMovieDialog
        movie={deletingMovie ? movie : null}
        onOpenChange={setDeletingMovie}
        onDeleted={() => void navigate({ to: "/movies" })}
      />
      <SceneSheet
        movieId={movieId}
        open={sceneSheet.open}
        scene={sceneSheet.scene}
        onOpenChange={(open) => setSceneSheet((s) => ({ ...s, open }))}
      />
      <DeleteSceneDialog
        movieId={movieId}
        scene={deletingScene}
        onOpenChange={(open) => !open && setDeletingScene(null)}
      />
    </>
  )
}
