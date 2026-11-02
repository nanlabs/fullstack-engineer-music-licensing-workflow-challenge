import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { PageHeader } from "@/components/layout/page-header"
import { DeleteSongDialog } from "@/components/songs/delete-song-dialog"
import { RightsHolderBadge } from "@/components/songs/rights-holder-badge"
import { SongSheet } from "@/components/songs/song-sheet"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCan } from "@/lib/auth/use-can"
import { formatDateTime } from "@/lib/format/dates"
import { formatTimecode } from "@/lib/format/timecode"
import { songQueries } from "@/lib/queries/songs"

export const Route = createFileRoute("/_app/songs/$songId")({
  loader: ({ context: { queryClient }, params: { songId } }) =>
    queryClient.ensureQueryData(songQueries.detail(songId)),
  component: SongPage,
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

function SongPage() {
  const { songId } = Route.useParams()
  const navigate = useNavigate()
  const { data: song } = useSuspenseQuery(songQueries.detail(songId))
  const canWrite = useCan("movies:write")
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Canciones", to: "/songs" }, { label: song.title }]}
        title={song.title}
        meta={
          <span className="text-sm text-muted-foreground">{song.artist}</span>
        }
        actions={
          canWrite ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
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
                    onSelect={() => setDeleting(true)}
                  >
                    <Trash2Icon /> Eliminar canción
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <section
          aria-label="Grabación"
          className="rounded-lg border bg-card p-5"
        >
          <h2 className="mb-4 text-base font-semibold">Grabación</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Fact label="Álbum">{song.album ?? "–"}</Fact>
            <Fact label="Año">{song.release_year ?? "–"}</Fact>
            <Fact label="Duración" mono>
              {song.duration_ms != null
                ? formatTimecode(song.duration_ms)
                : "–"}
            </Fact>
            <Fact label="ISRC" mono>
              {song.isrc ?? "–"}
            </Fact>
            <Fact label="ISWC" mono>
              {song.iswc ?? "–"}
            </Fact>
            <Fact label="Añadida">{formatDateTime(song.created_at)}</Fact>
          </dl>
        </section>
        <section
          aria-label="Titular de derechos"
          className="rounded-lg border bg-card p-5"
        >
          <h2 className="mb-4 text-base font-semibold">Titular de derechos</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Fact label="Nombre">
              <span className="flex items-center gap-2">
                {song.rights_holder}
                <RightsHolderBadge kind={song.rights_holder_kind} />
              </span>
            </Fact>
            <Fact label="Email de contacto">
              {song.rights_holder_email ? (
                <a
                  href={`mailto:${song.rights_holder_email}`}
                  className="hover:underline"
                >
                  {song.rights_holder_email}
                </a>
              ) : (
                "–"
              )}
            </Fact>
          </dl>
          {song.notes ? (
            <p className="mt-4 border-l-2 pl-3 text-sm text-muted-foreground">
              {song.notes}
            </p>
          ) : null}
        </section>
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        Los cues que usan esta canción se ven en cada escena; la API no ofrece
        todavía la lista por canción.
      </p>
      <SongSheet open={editing} onOpenChange={setEditing} song={song} />
      <DeleteSongDialog
        song={deleting ? song : null}
        onOpenChange={setDeleting}
        onDeleted={() => void navigate({ to: "/songs" })}
      />
    </>
  )
}
