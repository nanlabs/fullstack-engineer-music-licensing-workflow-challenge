import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Music2Icon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { z } from "zod"

import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { PaginationControls } from "@/components/shared/pagination-controls"
import { SearchInput } from "@/components/shared/search-input"
import { DeleteSongDialog } from "@/components/songs/delete-song-dialog"
import { SongSheet } from "@/components/songs/song-sheet"
import { SongTable } from "@/components/songs/song-table"
import { Button } from "@/components/ui/button"
import type { Song, SongFilter } from "@/lib/api/types"
import { useCan } from "@/lib/auth/use-can"
import { songQueries } from "@/lib/queries/songs"

const searchSchema = z.object({
  q: z.string().optional(),
  page: z.number().int().min(1).optional(),
})
type Search = z.infer<typeof searchSchema>

function toFilter(search: Search): SongFilter {
  return { q: search.q || undefined, page: search.page ?? 1, page_size: 20 }
}

export const Route = createFileRoute("/_app/songs/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(songQueries.list(toFilter(deps))),
  component: SongsPage,
})

function SongsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(songQueries.list(toFilter(search)))
  const canWrite = useCan("movies:write")
  const [sheet, setSheet] = useState<{ open: boolean; song?: Song }>({
    open: false,
  })
  const [deleting, setDeleting] = useState<Song | null>(null)

  const patch = (next: Partial<Search>) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true })

  return (
    <>
      <PageHeader
        title="Canciones"
        description="El catálogo que se coloca en los cues, con el titular de derechos con quien se negocia cada licencia."
        actions={
          canWrite ? (
            <Button onClick={() => setSheet({ open: true })}>
              <PlusIcon data-icon="inline-start" /> Nueva canción
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex items-center gap-2">
        <SearchInput
          value={search.q ?? ""}
          onChange={(q) => patch({ q: q || undefined, page: undefined })}
          placeholder="Buscar por título o artista"
          className="w-80"
        />
      </div>
      {data.empty ? (
        search.q ? (
          <EmptyState
            icon={<Music2Icon />}
            title="Ninguna canción coincide con la búsqueda."
          />
        ) : (
          <EmptyState
            icon={<Music2Icon />}
            title="El catálogo está vacío."
            description={
              canWrite
                ? "Añade la primera canción con su titular de derechos."
                : undefined
            }
            action={
              canWrite ? (
                <Button onClick={() => setSheet({ open: true })}>
                  <PlusIcon data-icon="inline-start" /> Nueva canción
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          <SongTable
            songs={data.items}
            canWrite={canWrite}
            onEdit={(song) => setSheet({ open: true, song })}
            onDelete={setDeleting}
          />
          <PaginationControls
            pagination={data.pagination}
            onPage={(page) => patch({ page: page === 1 ? undefined : page })}
            noun={["canción", "canciones"]}
          />
        </div>
      )}
      <SongSheet
        open={sheet.open}
        song={sheet.song}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
      />
      <DeleteSongDialog
        song={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </>
  )
}
