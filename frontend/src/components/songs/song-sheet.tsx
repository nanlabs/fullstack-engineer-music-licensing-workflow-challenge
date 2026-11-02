import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import {
  SongForm,
  toCreateSong,
  toUpdateSong,
} from "@/components/songs/song-form"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Song } from "@/lib/api/types"
import { useCreateSong, useUpdateSong } from "@/lib/queries/songs"

interface SongSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  song?: Song
}

export function SongSheet({ open, onOpenChange, song }: SongSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        {open ? (
          <SongSheetBody song={song} onClose={() => onOpenChange(false)} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function SongSheetBody({
  song,
  onClose,
}: {
  song?: Song
  onClose: () => void
}) {
  const navigate = useNavigate()
  const create = useCreateSong()
  const update = useUpdateSong(song?.id ?? "")
  const pending = create.isPending || update.isPending
  const formId = song ? `song-form-${song.id}` : "song-form-new"

  return (
    <>
      <SheetHeader>
        <SheetTitle>{song ? "Editar canción" : "Nueva canción"}</SheetTitle>
        <SheetDescription>
          {song
            ? "Los cues que la usan mostrarán los datos nuevos."
            : "Después podrás colocarla en los cues de cualquier escena."}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <SongForm
          id={formId}
          song={song}
          error={song ? update.error : create.error}
          onSubmit={(values) => {
            if (song) {
              update.mutate(toUpdateSong(values), {
                onSuccess: () => {
                  toast.success("Canción guardada")
                  onClose()
                },
              })
            } else {
              create.mutate(toCreateSong(values), {
                onSuccess: (created) => {
                  toast.success("Canción creada")
                  onClose()
                  void navigate({
                    to: "/songs/$songId",
                    params: { songId: created.id },
                  })
                },
              })
            }
          }}
        />
      </div>
      <SheetFooter className="flex-row justify-end">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" form={formId} disabled={pending}>
          {pending ? "Guardando…" : song ? "Guardar cambios" : "Crear canción"}
        </Button>
      </SheetFooter>
    </>
  )
}
