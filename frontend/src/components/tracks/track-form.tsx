import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { ErrorState } from "@/components/layout/error-state"
import { TIMECODE_HINT } from "@/components/scenes/scene-form"
import { useServerFieldErrors } from "@/components/shared/form-helpers"
import { SongPicker } from "@/components/songs/song-picker"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TRACK_USAGES,
  type CreateTrack,
  type Scene,
  type SongSummary,
  type Track,
} from "@/lib/api/types"
import { TRACK_USAGE_LABEL } from "@/lib/format/labels"
import { formatTimecode, parseTimecode } from "@/lib/format/timecode"

function buildSchema(scene: Pick<Scene, "start_ms" | "end_ms">) {
  const window =
    scene.start_ms !== null && scene.end_ms !== null
      ? { start: scene.start_ms, end: scene.end_ms }
      : null
  const windowText = window
    ? `${formatTimecode(window.start)} – ${formatTimecode(window.end)}`
    : null
  const outside = `Debe caer dentro de la ventana de la escena (${windowText})`
  return z
    .object({
      song: z.custom<SongSummary | null>(
        (v) => v !== null && typeof v === "object",
        "Elige una canción"
      ),
      usage: z.enum(TRACK_USAGES),
      start: z.string().trim().min(1, "Indica la entrada"),
      end: z.string().trim().min(1, "Indica la salida"),
    })
    .superRefine((v, ctx) => {
      const start = parseTimecode(v.start)
      const end = parseTimecode(v.end)
      if (start === null)
        ctx.addIssue({
          code: "custom",
          path: ["start"],
          message: TIMECODE_HINT,
        })
      if (end === null)
        ctx.addIssue({ code: "custom", path: ["end"], message: TIMECODE_HINT })
      if (start === null || end === null) return
      if (end <= start)
        ctx.addIssue({
          code: "custom",
          path: ["end"],
          message: "La salida debe ser posterior a la entrada",
        })
      if (window) {
        if (start < window.start || start > window.end)
          ctx.addIssue({ code: "custom", path: ["start"], message: outside })
        if (end > window.end || end < window.start)
          ctx.addIssue({ code: "custom", path: ["end"], message: outside })
      }
    })
}
type TrackFormValues = z.infer<ReturnType<typeof buildSchema>>

export function toTrackBody(values: TrackFormValues): CreateTrack {
  const start = parseTimecode(values.start)
  const end = parseTimecode(values.end)
  if (!values.song || start === null || end === null)
    throw new Error("Track form submitted before validation")
  return {
    song_id: values.song.id,
    usage: values.usage,
    start_ms: start,
    end_ms: end,
  }
}

interface TrackFormProps {
  id: string
  scene: Scene
  track?: Track
  error?: unknown
  onSubmit: (body: CreateTrack) => void
}

export function TrackForm({
  id,
  scene,
  track,
  error,
  onSubmit,
}: TrackFormProps) {
  const form = useForm<TrackFormValues>({
    resolver: zodResolver(buildSchema(scene)),
    defaultValues: {
      song: track?.song ?? null,
      usage: track?.usage ?? "background",
      start: track
        ? formatTimecode(track.start_ms)
        : scene.start_ms !== null
          ? formatTimecode(scene.start_ms)
          : "",
      end: track ? formatTimecode(track.end_ms) : "",
    },
  })
  const { errors } = form.formState
  const serverHandled = useServerFieldErrors(error, form.setError, {
    song_id: "song",
    start_ms: "start",
    end_ms: "end",
    usage: "usage",
  })
  const window =
    scene.start_ms !== null && scene.end_ms !== null
      ? `${formatTimecode(scene.start_ms)} – ${formatTimecode(scene.end_ms)}`
      : null

  return (
    <form
      id={id}
      onSubmit={form.handleSubmit((values) => onSubmit(toTrackBody(values)))}
      noValidate
    >
      <FieldGroup>
        <Field data-invalid={!!errors.song || undefined}>
          <FieldLabel htmlFor={`${id}-song`}>Canción</FieldLabel>
          <Controller
            control={form.control}
            name="song"
            render={({ field }) => (
              <SongPicker
                id={`${id}-song`}
                value={field.value}
                onChange={field.onChange}
                invalid={!!errors.song}
              />
            )}
          />
          <FieldError
            errors={[errors.song as { message?: string } | undefined]}
          />
        </Field>
        <Field data-invalid={!!errors.usage || undefined}>
          <FieldLabel htmlFor={`${id}-usage`}>Uso</FieldLabel>
          <Controller
            control={form.control}
            name="usage"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`${id}-usage`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRACK_USAGES.map((u) => (
                    <SelectItem key={u} value={u}>
                      {TRACK_USAGE_LABEL[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldDescription>
            De fondo suena bajo la acción; destacada es protagonista de la
            escena.
          </FieldDescription>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!errors.start || undefined}>
            <FieldLabel htmlFor={`${id}-start`}>Entrada</FieldLabel>
            <Input
              id={`${id}-start`}
              className="timecode"
              placeholder="00:15"
              aria-invalid={!!errors.start || undefined}
              {...form.register("start")}
            />
            <FieldError errors={[errors.start]} />
          </Field>
          <Field data-invalid={!!errors.end || undefined}>
            <FieldLabel htmlFor={`${id}-end`}>Salida</FieldLabel>
            <Input
              id={`${id}-end`}
              className="timecode"
              placeholder="01:35"
              aria-invalid={!!errors.end || undefined}
              {...form.register("end")}
            />
            <FieldError errors={[errors.end]} />
          </Field>
        </div>
        <FieldDescription className="-mt-3">
          Tiempos de la película, en minutos y segundos.
          {window
            ? ` La escena ocupa ${window}.`
            : " Esta escena no tiene ventana."}
        </FieldDescription>
        {error && !serverHandled ? <ErrorState error={error} /> : null}
      </FieldGroup>
    </form>
  )
}
