import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { ErrorState } from "@/components/layout/error-state"
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
  MOVIE_STATUSES,
  type CreateMovie,
  type Movie,
  type UpdateMovie,
} from "@/lib/api/types"
import { MOVIE_STATUS_LABEL } from "@/lib/format/labels"

export const yearField = (min: number) =>
  z
    .string()
    .trim()
    .refine(
      (v) =>
        v === "" ||
        (/^\d{4}$/.test(v) && Number(v) >= min && Number(v) <= 2100),
      {
        message: `Un año entre ${min} y 2100`,
      }
    )

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "El título es obligatorio")
    .max(200, "Máximo 200 caracteres"),
  synopsis: z.string().trim().max(2000, "Máximo 2000 caracteres"),
  release_year: yearField(1888),
  status: z.enum(MOVIE_STATUSES),
})
export type MovieFormValues = z.infer<typeof schema>

export interface MovieFormProps {
  id: string
  movie?: Movie
  error?: unknown
  onSubmit: (body: CreateMovie & UpdateMovie) => void
}

export function toMovieBody(
  values: MovieFormValues,
  editing: boolean
): CreateMovie & UpdateMovie {
  return {
    title: values.title,
    // On edit an empty synopsis clears the stored one; on create it is simply absent.
    synopsis: editing ? values.synopsis : emptyToUndefined(values.synopsis),
    release_year: values.release_year ? Number(values.release_year) : undefined,
    status: values.status,
  }
}

export function MovieForm({ id, movie, error, onSubmit }: MovieFormProps) {
  const form = useForm<MovieFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: movie?.title ?? "",
      synopsis: movie?.synopsis ?? "",
      release_year: movie?.release_year?.toString() ?? "",
      status: movie?.status ?? "draft",
    },
  })
  const { errors } = form.formState
  const serverHandled = useServerFieldErrors(error, form.setError, {
    title: "title",
    synopsis: "synopsis",
    release_year: "release_year",
    status: "status",
  })

  return (
    <form
      id={id}
      onSubmit={form.handleSubmit((values) =>
        onSubmit(toMovieBody(values, !!movie))
      )}
      noValidate
    >
      <FieldGroup>
        <Field data-invalid={!!errors.title || undefined}>
          <FieldLabel htmlFor={`${id}-title`}>Título</FieldLabel>
          <Input
            id={`${id}-title`}
            autoFocus
            aria-invalid={!!errors.title || undefined}
            {...form.register("title")}
          />
          <FieldError errors={[errors.title]} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!errors.release_year || undefined}>
            <FieldLabel htmlFor={`${id}-year`}>Año de estreno</FieldLabel>
            <Input
              id={`${id}-year`}
              inputMode="numeric"
              placeholder="2026"
              aria-invalid={!!errors.release_year || undefined}
              {...form.register("release_year")}
            />
            <FieldError errors={[errors.release_year]} />
          </Field>
          <Field data-invalid={!!errors.status || undefined}>
            <FieldLabel htmlFor={`${id}-status`}>Estado</FieldLabel>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`${id}-status`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOVIE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {MOVIE_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.status]} />
          </Field>
        </div>
        <Field data-invalid={!!errors.synopsis || undefined}>
          <FieldLabel htmlFor={`${id}-synopsis`}>Sinopsis</FieldLabel>
          <Textarea
            id={`${id}-synopsis`}
            rows={4}
            aria-invalid={!!errors.synopsis || undefined}
            {...form.register("synopsis")}
          />
          <FieldDescription>Opcional. Hasta 2000 caracteres.</FieldDescription>
          <FieldError errors={[errors.synopsis]} />
        </Field>
        {error && !serverHandled ? <ErrorState error={error} /> : null}
      </FieldGroup>
    </form>
  )
}
