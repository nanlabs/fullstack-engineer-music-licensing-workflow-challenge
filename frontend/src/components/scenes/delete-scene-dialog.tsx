import { toast } from "sonner"

import { LockedTracksNotice } from "@/components/licenses/locked-tracks-notice"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { Scene } from "@/lib/api/types"
import { useDeleteScene } from "@/lib/queries/scenes"

interface DeleteSceneDialogProps {
  movieId: string
  scene: Scene | null
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteSceneDialog({
  movieId,
  scene,
  onOpenChange,
  onDeleted,
}: DeleteSceneDialogProps) {
  const remove = useDeleteScene(movieId)
  return (
    <ConfirmDialog
      open={scene !== null}
      onOpenChange={(open) => {
        if (!open) remove.reset()
        onOpenChange(open)
      }}
      title={scene ? `Eliminar «${scene.title}»` : "Eliminar escena"}
      description="Se eliminan también sus cues. No se puede eliminar mientras alguna licencia esté solicitada, en negociación o aprobada."
      confirmLabel="Eliminar escena"
      destructive
      pending={remove.isPending}
      error={remove.error}
      errorExtra={<LockedTracksNotice error={remove.error} />}
      onConfirm={() => {
        if (!scene) return
        remove.mutate(scene.id, {
          onSuccess: () => {
            toast.success("Escena eliminada")
            onOpenChange(false)
            onDeleted?.()
          },
        })
      }}
    />
  )
}
