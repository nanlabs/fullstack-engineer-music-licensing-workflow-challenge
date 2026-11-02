import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { MovieForm } from "@/components/movies/movie-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Movie } from "@/lib/api/types"
import { useCreateMovie, useUpdateMovie } from "@/lib/queries/movies"

interface MovieDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing. */
  movie?: Movie
}

export function MovieDialog({ open, onOpenChange, movie }: MovieDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <MovieDialogBody movie={movie} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MovieDialogBody({
  movie,
  onClose,
}: {
  movie?: Movie
  onClose: () => void
}) {
  const navigate = useNavigate()
  const create = useCreateMovie()
  const update = useUpdateMovie(movie?.id ?? "")
  const mutation = movie ? update : create
  const formId = movie ? `movie-form-${movie.id}` : "movie-form-new"

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {movie ? "Editar película" : "Nueva película"}
        </DialogTitle>
        <DialogDescription>
          {movie
            ? "Los cambios no afectan a sus escenas ni a sus licencias."
            : "Después podrás añadir escenas y cues."}
        </DialogDescription>
      </DialogHeader>
      <MovieForm
        id={formId}
        movie={movie}
        error={mutation.error}
        onSubmit={(body) =>
          mutation.mutate(body, {
            onSuccess: (saved) => {
              toast.success(movie ? "Película guardada" : "Película creada")
              onClose()
              if (!movie)
                void navigate({
                  to: "/movies/$movieId",
                  params: { movieId: saved.id },
                })
            },
          })
        }
      />
      <DialogFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" form={formId} disabled={mutation.isPending}>
          {mutation.isPending
            ? "Guardando…"
            : movie
              ? "Guardar cambios"
              : "Crear película"}
        </Button>
      </DialogFooter>
    </>
  )
}
