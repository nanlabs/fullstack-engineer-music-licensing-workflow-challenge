import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { Suspense, useState } from "react"

import { PageHeader } from "@/components/layout/page-header"
import { RoutePending } from "@/components/layout/route-states"
import { LicenseActions } from "@/components/licenses/license-actions"
import { LicenseHistory } from "@/components/licenses/license-history"
import { LicenseStateBadge } from "@/components/licenses/license-state-badge"
import { TransitionDialog } from "@/components/licenses/transition-dialog"
import { DeleteTrackDialog } from "@/components/tracks/delete-track-dialog"
import {
  TrackLockNotice,
  lockReason,
} from "@/components/tracks/track-lock-notice"
import { TrackSheet } from "@/components/tracks/track-sheet"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { LicenseEventKind } from "@/lib/api/types"
import { useCan } from "@/lib/auth/use-can"
import { formatDateTime, formatRelative, isPastDate } from "@/lib/format/dates"
import { TRACK_USAGE_LABEL } from "@/lib/format/labels"
import { formatDuration, formatTimecode } from "@/lib/format/timecode"
import { licenseQueries } from "@/lib/queries/licenses"
import { movieQueries } from "@/lib/queries/movies"
import { sceneQueries } from "@/lib/queries/scenes"
import { trackQueries } from "@/lib/queries/tracks"

export const Route = createFileRoute("/_app/tracks/$trackId")({
  loader: async ({ context: { queryClient }, params: { trackId } }) => {
    const track = await queryClient.ensureQueryData(
      trackQueries.detail(trackId)
    )
    await Promise.all([
      queryClient.ensureQueryData(movieQueries.detail(track.movie_id)),
      queryClient.ensureQueryData(sceneQueries.detail(track.scene_id)),
      queryClient.prefetchQuery(licenseQueries.history(trackId)),
    ])
  },
  component: TrackPage,
})

function Fact({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "timecode text-sm" : "text-sm"}>{children}</dd>
    </div>
  )
}

function TrackPage() {
  const { trackId } = Route.useParams()
  const navigate = useNavigate()
  const { data: track } = useSuspenseQuery(trackQueries.detail(trackId))
  const { data: movie } = useSuspenseQuery(movieQueries.detail(track.movie_id))
  const { data: scene } = useSuspenseQuery(sceneQueries.detail(track.scene_id))
  const canWriteMovies = useCan("movies:write")
  const canWriteLicenses = useCan("licenses:write")

  const [event, setEvent] = useState<LicenseEventKind | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const locked = lockReason(track.license.state)
  const { license } = track

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Películas", to: "/movies" },
          {
            label: movie.title,
            to: "/movies/$movieId",
            params: { movieId: movie.id },
          },
          {
            label: scene.title,
            to: "/movies/$movieId/scenes/$sceneId",
            params: { movieId: movie.id, sceneId: scene.id },
          },
          { label: track.song.title },
        ]}
        title={track.song.title}
        meta={
          <span className="text-sm text-muted-foreground">
            {track.song.artist}
          </span>
        }
        actions={
          canWriteMovies ? (
            <>
              <Button
                variant="outline"
                onClick={() => setEditing(true)}
                disabled={!!locked}
                title={locked ?? undefined}
              >
                <PencilIcon data-icon="inline-start" /> Editar cue
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
                    disabled={!!locked}
                    onSelect={() => setDeleting(true)}
                  >
                    <Trash2Icon /> Quitar cue
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-5">
          <section
            aria-label="Licencia"
            className="rounded-lg border bg-card p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Licencia</p>
                <LicenseStateBadge state={license.state} size="lg" />
                <p
                  className="mt-1 text-xs text-muted-foreground"
                  title={formatDateTime(license.updated_at)}
                >
                  Último cambio {formatRelative(license.updated_at)}
                </p>
              </div>
              {license.expires_at ? (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {isPastDate(license.expires_at) ? "Caducó el" : "Caduca el"}
                  </p>
                  <p className="text-sm">
                    {formatDateTime(license.expires_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelative(license.expires_at)}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-5">
              {license.allowed_events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta licencia ha expirado y no admite más cambios. Si la
                  canción vuelve a necesitarse, añade un cue nuevo.
                </p>
              ) : canWriteLicenses ? (
                <LicenseActions track={track} canWrite onPick={setEvent} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Solo quien gestiona licencias puede moverla.
                </p>
              )}
            </div>
          </section>

          <section aria-label="Cue" className="rounded-lg border bg-card p-5">
            <h2 className="mb-4 text-base font-semibold">Cue</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Fact label="Película">
                <Link
                  to="/movies/$movieId"
                  params={{ movieId: movie.id }}
                  className="hover:underline"
                >
                  {movie.title}
                </Link>
              </Fact>
              <Fact label="Escena">
                <Link
                  to="/movies/$movieId/scenes/$sceneId"
                  params={{ movieId: movie.id, sceneId: scene.id }}
                  className="hover:underline"
                >
                  {scene.position}. {scene.title}
                </Link>
              </Fact>
              <Fact label="Uso">{TRACK_USAGE_LABEL[track.usage]}</Fact>
              <Fact label="Entrada" mono>
                {formatTimecode(track.start_ms)}
              </Fact>
              <Fact label="Salida" mono>
                {formatTimecode(track.end_ms)}
              </Fact>
              <Fact label="Duración">{formatDuration(track.duration_ms)}</Fact>
              <Fact label="Canción">
                <Link
                  to="/songs/$songId"
                  params={{ songId: track.song.id }}
                  className="hover:underline"
                >
                  {track.song.title}
                </Link>
              </Fact>
              <Fact label="Artista">{track.song.artist}</Fact>
              <Fact label="Titular de derechos">
                {track.song.rights_holder}
              </Fact>
            </dl>
            <TrackLockNotice state={license.state} className="mt-5" />
          </section>
        </div>

        <Suspense fallback={<RoutePending />}>
          <LicenseHistory trackId={track.id} />
        </Suspense>
      </div>

      <TransitionDialog
        track={track}
        event={event}
        onOpenChange={(open) => !open && setEvent(null)}
      />
      <TrackSheet
        scene={scene}
        open={editing}
        onOpenChange={setEditing}
        track={track}
      />
      <DeleteTrackDialog
        track={deleting ? track : null}
        onOpenChange={setDeleting}
        onDeleted={() =>
          void navigate({
            to: "/movies/$movieId/scenes/$sceneId",
            params: { movieId: movie.id, sceneId: scene.id },
          })
        }
      />
    </>
  )
}
