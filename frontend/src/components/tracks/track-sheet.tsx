import { toast } from "sonner"

import { TrackForm } from "@/components/tracks/track-form"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Scene, Track } from "@/lib/api/types"
import { useCreateTrack, useUpdateTrack } from "@/lib/queries/tracks"

interface TrackSheetProps {
  scene: Scene
  open: boolean
  onOpenChange: (open: boolean) => void
  track?: Track
}

export function TrackSheet({
  scene,
  open,
  onOpenChange,
  track,
}: TrackSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        {open ? (
          <TrackSheetBody
            scene={scene}
            track={track}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function TrackSheetBody({
  scene,
  track,
  onClose,
}: {
  scene: Scene
  track?: Track
  onClose: () => void
}) {
  const create = useCreateTrack(scene.id)
  const update = useUpdateTrack(
    track ?? { id: "", scene_id: scene.id, movie_id: scene.movie_id }
  )
  const mutation = track ? update : create
  const formId = track ? `track-form-${track.id}` : "track-form-new"

  return (
    <>
      <SheetHeader>
        <SheetTitle>{track ? "Editar cue" : "Añadir cue"}</SheetTitle>
        <SheetDescription>
          {track
            ? "La licencia no cambia al editar el cue."
            : `En «${scene.title}». La licencia nace pendiente; después la solicitas desde el cue.`}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-4">
        <TrackForm
          id={formId}
          scene={scene}
          track={track}
          error={mutation.error}
          onSubmit={(body) =>
            mutation.mutate(body, {
              onSuccess: () => {
                toast.success(track ? "Cue guardado" : "Cue añadido")
                onClose()
              },
            })
          }
        />
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
            : track
              ? "Guardar cambios"
              : "Añadir cue"}
        </Button>
      </SheetFooter>
    </>
  )
}
