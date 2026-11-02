import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { ErrorState } from "@/components/layout/error-state"
import { yearField } from "@/components/movies/movie-form"
import { TIMECODE_HINT } from "@/components/scenes/scene-form"
import {
  emptyToUndefined,
  useServerFieldErrors,
} from "@/components/shared/form-helpers"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  RIGHTS_HOLDER_KINDS,
  type CreateSong,
  type Song,
  type UpdateSong,
} from "@/lib/api/types"
import { RIGHTS_HOLDER_KIND_LABEL } from "@/lib/format/labels"
import { formatTimecode, parseTimecode } from "@/lib/format/timecode"

const text = (max: number, required?: string) => {
  const base = z.string().trim().max(max, `Máximo ${max} caracteres`)
  return required ? base.min(1, required) : base
}

const schema = z.object({
  title: text(200, "El título es obligatorio"),
  artist: text(200, "El artista es obligatorio"),
  album: text(200),
  release_year: yearField(1877),
  duration: z
    .string()
    .trim()
    .refine((v) => v === "" || parseTimecode(v) !== null, TIMECODE_HINT),
  isrc: text(20),
  iswc: text(20),
  rights_holder: text(200, "El titular de derechos es obligatorio"),
  rights_holder_kind: z.enum([...RIGHTS_HOLDER_KINDS, "none"]),
  rights_holder_email: z.union([
    z.literal(""),
    z.email("Escribe un email válido"),
  ]),
  notes: text(2000),
})
export type SongFormValues = z.infer<typeof schema>

export function toCreateSong(v: SongFormValues): CreateSong {
  const duration = v.duration ? parseTimecode(v.duration) : null
  return {
    title: v.title,
    artist: v.artist,
    rights_holder: v.rights_holder,
    album: emptyToUndefined(v.album),
    release_year: v.release_year ? Number(v.release_year) : undefined,
    duration_ms: duration ?? undefined,
    isrc: emptyToUndefined(v.isrc),
    iswc: emptyToUndefined(v.iswc),
    rights_holder_kind:
      v.rights_holder_kind === "none" ? undefined : v.rights_holder_kind,
    rights_holder_email: emptyToUndefined(v.rights_holder_email),
    notes: emptyToUndefined(v.notes),
  }
}

/** On edit, `""` clears a text field and `null` clears year, duration and kind. */
export function toUpdateSong(v: SongFormValues): UpdateSong {
  return {
    title: v.title,
    artist: v.artist,
    rights_holder: v.rights_holder,
    album: v.album,
    release_year: v.release_year ? Number(v.release_year) : null,
    duration_ms: v.duration ? parseTimecode(v.duration) : null,
    isrc: v.isrc,
    iswc: v.iswc,
    rights_holder_kind:
      v.rights_holder_kind === "none" ? null : v.rights_holder_kind,
    rights_holder_email: v.rights_holder_email,
    notes: v.notes,
  }
}

interface SongFormProps {
  id: string
  song?: Song
  error?: unknown
  onSubmit: (values: SongFormValues) => void
}

export function SongForm({ id, song, error, onSubmit }: SongFormProps) {
  const form = useForm<SongFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: song?.title ?? "",
      artist: song?.artist ?? "",
      album: song?.album ?? "",
      release_year: song?.release_year?.toString() ?? "",
      duration:
        song?.duration_ms != null ? formatTimecode(song.duration_ms) : "",
      isrc: song?.isrc ?? "",
      iswc: song?.iswc ?? "",
      rights_holder: song?.rights_holder ?? "",
      rights_holder_kind: song?.rights_holder_kind ?? "none",
      rights_holder_email: song?.rights_holder_email ?? "",
      notes: song?.notes ?? "",
    },
  })
  const { errors } = form.formState
  const serverHandled = useServerFieldErrors(error, form.setError, {
    title: "title",
    artist: "artist",
    album: "album",
    release_year: "release_year",
    duration_ms: "duration",
    isrc: "isrc",
    iswc: "iswc",
    rights_holder: "rights_holder",
    rights_holder_kind: "rights_holder_kind",
    rights_holder_email: "rights_holder_email",
    notes: "notes",
  })

  const textField = (
    name: keyof SongFormValues,
    label: string,
    extra?: { placeholder?: string; mono?: boolean; description?: string }
  ) => (
    <Field data-invalid={!!errors[name] || undefined}>
      <FieldLabel htmlFor={`${id}-${name}`}>{label}</FieldLabel>
      <Input
        id={`${id}-${name}`}
        placeholder={extra?.placeholder}
        className={extra?.mono ? "timecode" : undefined}
        aria-invalid={!!errors[name] || undefined}
        {...form.register(name)}
      />
      {extra?.description ? (
        <FieldDescription>{extra.description}</FieldDescription>
      ) : null}
      <FieldError errors={[errors[name]]} />
    </Field>
  )

  return (
    <form id={id} onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {textField("title", "Título")}
        {textField("artist", "Artista")}
        <div className="grid grid-cols-2 gap-4">
          {textField("album", "Álbum")}
          {textField("release_year", "Año", { placeholder: "1999" })}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {textField("duration", "Duración", {
            placeholder: "03:45",
            mono: true,
          })}
          {textField("isrc", "ISRC", {
            placeholder: "US-RC1-77-00001",
            mono: true,
            description: "Con o sin guiones.",
          })}
        </div>
        {textField("iswc", "ISWC", {
          placeholder: "T-034.524.680-1",
          mono: true,
        })}
        <FieldSet>
          <FieldLegend variant="label">Titular de derechos</FieldLegend>
          <FieldDescription>
            Con quién se negocia la licencia. No es un usuario de la aplicación.
          </FieldDescription>
          <FieldGroup>
            {textField("rights_holder", "Nombre")}
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.rights_holder_kind || undefined}>
                <FieldLabel htmlFor={`${id}-kind`}>Tipo</FieldLabel>
                <Controller
                  control={form.control}
                  name="rights_holder_kind"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={`${id}-kind`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin especificar</SelectItem>
                        {RIGHTS_HOLDER_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {RIGHTS_HOLDER_KIND_LABEL[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              {textField("rights_holder_email", "Email de contacto", {
                placeholder: "licensing@label.test",
              })}
            </div>
          </FieldGroup>
        </FieldSet>
        <Field data-invalid={!!errors.notes || undefined}>
          <FieldLabel htmlFor={`${id}-notes`}>Notas</FieldLabel>
          <Textarea
            id={`${id}-notes`}
            rows={3}
            aria-invalid={!!errors.notes || undefined}
            {...form.register("notes")}
          />
          <FieldError errors={[errors.notes]} />
        </Field>
        {error && !serverHandled ? <ErrorState error={error} /> : null}
      </FieldGroup>
    </form>
  )
}
