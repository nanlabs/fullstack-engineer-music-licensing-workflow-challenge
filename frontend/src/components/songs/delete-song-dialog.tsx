import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { Song } from "@/lib/api/types"
import { useDeleteSong } from "@/lib/queries/songs"

interface DeleteSongDialogProps {
  song: Song | null
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteSongDialog({
  song,
  onOpenChange,
  onDeleted,
}: DeleteSongDialogProps) {
  const remove = useDeleteSong()
  return (
    <ConfirmDialog
      open={song !== null}
      onOpenChange={(open) => {
        if (!open) remove.reset()
        onOpenChange(open)
      }}
      title={song ? `Eliminar «${song.title}»` : "Eliminar canción"}
      description="Solo es posible si ningún cue la usa."
      confirmLabel="Eliminar canción"
      destructive
      pending={remove.isPending}
      error={remove.error}
      onConfirm={() => {
        if (!song) return
        remove.mutate(song.id, {
          onSuccess: () => {
            toast.success("Canción eliminada")
            onOpenChange(false)
            onDeleted?.()
          },
        })
      }}
    />
  )
}
