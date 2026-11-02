import { toast } from "sonner"

import { LockedTracksNotice } from "@/components/licenses/locked-tracks-notice"
import {
  SceneForm,
  toCreateScene,
  toUpdateScene,
} from "@/components/scenes/scene-form"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Scene } from "@/lib/api/types"
import { useCreateScene, useUpdateScene } from "@/lib/queries/scenes"

interface SceneSheetProps {
  movieId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  scene?: Scene
}

export function SceneSheet({
  movieId,
  open,
  onOpenChange,
  scene,
}: SceneSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        {open ? (
          <SceneSheetBody
            movieId={movieId}
            scene={scene}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function SceneSheetBody({
  movieId,
  scene,
  onClose,
}: {
  movieId: string
  scene?: Scene
  onClose: () => void
}) {
  const create = useCreateScene(movieId)
  const update = useUpdateScene(scene ?? { id: "", movie_id: movieId })
  const mutation = scene ? update : create
  const formId = scene ? `scene-form-${scene.id}` : "scene-form-new"

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {scene ? `Editar escena ${scene.position}` : "Nueva escena"}
        </SheetTitle>
        <SheetDescription>
          {scene
            ? "Reducir la ventana no es posible si deja cues fuera."
            : "Se añade al final; después puedes reordenarla."}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-4">
        <SceneForm
          id={formId}
          scene={scene}
          error={mutation.error}
          onSubmit={(values) => {
            const done = () => {
              toast.success(scene ? "Escena guardada" : "Escena creada")
              onClose()
            }
            if (scene) update.mutate(toUpdateScene(values), { onSuccess: done })
            else create.mutate(toCreateScene(values), { onSuccess: done })
          }}
        />
        {mutation.error ? <LockedTracksNotice error={mutation.error} /> : null}
      </div>
      <SheetFooter className="flex-row justify-end">
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
            : scene
              ? "Guardar cambios"
              : "Crear escena"}
        </Button>
      </SheetFooter>
    </>
  )
}
