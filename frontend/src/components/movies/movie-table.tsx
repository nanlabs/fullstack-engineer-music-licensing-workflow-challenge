import { Link } from "@tanstack/react-router"
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { MovieStatusBadge } from "@/components/movies/movie-status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Movie } from "@/lib/api/types"
import { formatRelative } from "@/lib/format/dates"

interface MovieTableProps {
  movies: Movie[]
  canWrite: boolean
  onEdit: (movie: Movie) => void
  onDelete: (movie: Movie) => void
}

export function MovieTable({
  movies,
  canWrite,
  onEdit,
  onDelete,
}: MovieTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Título</TableHead>
            <TableHead className="w-24">Año</TableHead>
            <TableHead className="w-40">Estado</TableHead>
            <TableHead className="w-40">Actualizada</TableHead>
            {canWrite ? <TableHead className="w-12" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {movies.map((movie) => (
            <TableRow key={movie.id} className="h-10">
              <TableCell className="font-medium">
                <Link
                  to="/movies/$movieId"
                  params={{ movieId: movie.id }}
                  className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {movie.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {movie.release_year ?? "–"}
              </TableCell>
              <TableCell>
                <MovieStatusBadge status={movie.status} />
              </TableCell>
              <TableCell
                className="text-muted-foreground"
                title={movie.updated_at}
              >
                {formatRelative(movie.updated_at)}
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Acciones de ${movie.title}`}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(movie)}>
                        <PencilIcon /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onDelete(movie)}
                      >
                        <Trash2Icon /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
