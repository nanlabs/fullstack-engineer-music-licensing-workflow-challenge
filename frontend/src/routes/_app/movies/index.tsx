import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { FilmIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { z } from "zod"

import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { DeleteMovieDialog } from "@/components/movies/delete-movie-dialog"
import { MovieDialog } from "@/components/movies/movie-dialog"
import { MovieTable } from "@/components/movies/movie-table"
import { PaginationControls } from "@/components/shared/pagination-controls"
import { SearchInput } from "@/components/shared/search-input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MOVIE_STATUSES, type Movie, type MovieFilter } from "@/lib/api/types"
import { useCan } from "@/lib/auth/use-can"
import { MOVIE_STATUS_LABEL } from "@/lib/format/labels"
import { movieQueries } from "@/lib/queries/movies"

const searchSchema = z.object({
  q: z.string().optional(),
  status: z.enum(MOVIE_STATUSES).optional(),
  page: z.number().int().min(1).optional(),
})
type Search = z.infer<typeof searchSchema>

const PAGE_SIZE = 20

function toFilter(search: Search): MovieFilter {
  return {
    q: search.q || undefined,
    status: search.status,
    page: search.page ?? 1,
    page_size: PAGE_SIZE,
  }
}

export const Route = createFileRoute("/_app/movies/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(movieQueries.list(toFilter(deps))),
  component: MoviesPage,
})

function MoviesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(movieQueries.list(toFilter(search)))
  const canWrite = useCan("movies:write")
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Movie | null>(null)
  const [deleting, setDeleting] = useState<Movie | null>(null)

  const patch = (next: Partial<Search>) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true })
  const filtered = !!search.q || !!search.status

  return (
    <>
      <PageHeader
        title="Películas"
        description="Cada película tiene escenas, y cada escena los cues cuya música hay que licenciar."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon data-icon="inline-start" /> Nueva película
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search.q ?? ""}
          onChange={(q) => patch({ q: q || undefined, page: undefined })}
          placeholder="Buscar por título"
          className="w-72"
        />
        <Select
          value={search.status ?? "all"}
          onValueChange={(value) =>
            patch({
              status: value === "all" ? undefined : (value as Search["status"]),
              page: undefined,
            })
          }
        >
          <SelectTrigger className="w-48" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {MOVIE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {MOVIE_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              patch({ q: undefined, status: undefined, page: undefined })
            }
          >
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      {data.empty ? (
        filtered ? (
          <EmptyState
            icon={<FilmIcon />}
            title="Ninguna película coincide con la búsqueda."
            description="Prueba con otro título o quita el filtro de estado."
          />
        ) : (
          <EmptyState
            icon={<FilmIcon />}
            title="Aún no hay películas."
            description={
              canWrite
                ? "Crea la primera y añade sus escenas."
                : "Cuando se cree una aparecerá aquí."
            }
            action={
              canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <PlusIcon data-icon="inline-start" /> Nueva película
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          <MovieTable
            movies={data.items}
            canWrite={canWrite}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
          <PaginationControls
            pagination={data.pagination}
            onPage={(page) => patch({ page: page === 1 ? undefined : page })}
            noun={["película", "películas"]}
          />
        </div>
      )}

      <MovieDialog open={creating} onOpenChange={setCreating} />
      <MovieDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        movie={editing ?? undefined}
      />
      <DeleteMovieDialog
        movie={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </>
  )
}
