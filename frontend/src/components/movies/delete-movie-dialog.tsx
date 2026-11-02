import { toast } from "sonner"

import { LockedTracksNotice } from "@/components/licenses/locked-tracks-notice"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { Movie } from "@/lib/api/types"
import { useDeleteMovie } from "@/lib/queries/movies"

interface DeleteMovieDialogProps {
  movie: Movie | null
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteMovieDialog({
  movie,
  onOpenChange,
  onDeleted,
}: DeleteMovieDialogProps) {
  const remove = useDeleteMovie()
  return (
    <ConfirmDialog
      open={movie !== null}
      onOpenChange={(open) => {
        if (!open) remove.reset()
        onOpenChange(open)
      }}
      title={movie ? `Eliminar «${movie.title}»` : "Eliminar película"}
      description="Se eliminan también sus escenas y sus cues. No se puede eliminar mientras alguna licencia esté solicitada, en negociación o aprobada."
      confirmLabel="Eliminar película"
      destructive
      pending={remove.isPending}
      error={remove.error}
      errorExtra={<LockedTracksNotice error={remove.error} />}
      onConfirm={() => {
        if (!movie) return
        remove.mutate(movie.id, {
          onSuccess: () => {
            toast.success("Película eliminada")
            onOpenChange(false)
            onDeleted?.()
          },
        })
      }}
    />
  )
}
