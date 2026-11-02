import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { Track } from "@/lib/api/types"
import { useDeleteTrack } from "@/lib/queries/tracks"

interface DeleteTrackDialogProps {
  track: Track | null
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteTrackDialog({
  track,
  onOpenChange,
  onDeleted,
}: DeleteTrackDialogProps) {
  const remove = useDeleteTrack(track ?? { id: "", scene_id: "", movie_id: "" })
  return (
    <ConfirmDialog
      open={track !== null}
      onOpenChange={(open) => {
        if (!open) remove.reset()
        onOpenChange(open)
      }}
      title={track ? `Quitar «${track.song.title}» de la escena` : "Quitar cue"}
      description="Se borra el cue y su historial de licencia. No es posible mientras la licencia esté solicitada, en negociación o aprobada."
      confirmLabel="Quitar cue"
      destructive
      pending={remove.isPending}
      error={remove.error}
      onConfirm={() =>
        remove.mutate(undefined, {
          onSuccess: () => {
            toast.success("Cue quitado")
            onOpenChange(false)
            onDeleted?.()
          },
        })
      }
    />
  )
}
