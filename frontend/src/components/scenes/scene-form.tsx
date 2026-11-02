import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
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
import { Textarea } from "@/components/ui/textarea"
import type { CreateScene, Scene, UpdateScene } from "@/lib/api/types"
import { formatTimecode, parseTimecode } from "@/lib/format/timecode"

export const TIMECODE_HINT = "Usa MM:SS o H:MM:SS, con .mmm opcional"

const schema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "El título es obligatorio")
      .max(200, "Máximo 200 caracteres"),
    description: z.string().trim().max(2000, "Máximo 2000 caracteres"),
    start: z.string().trim(),
    end: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const hasStart = v.start !== ""
    const hasEnd = v.end !== ""
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: "custom",
        path: [hasStart ? "end" : "start"],
        message: "Indica entrada y salida, o ninguna de las dos",
      })
      return
    }
    if (!hasStart) return
    const start = parseTimecode(v.start)
    const end = parseTimecode(v.end)
    if (start === null)
      ctx.addIssue({ code: "custom", path: ["start"], message: TIMECODE_HINT })
    if (end === null)
      ctx.addIssue({ code: "custom", path: ["end"], message: TIMECODE_HINT })
    if (start !== null && end !== null && end <= start) {
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message: "La salida debe ser posterior a la entrada",
      })
    }
  })
export type SceneFormValues = z.infer<typeof schema>

export function toCreateScene(values: SceneFormValues): CreateScene {
  const start = values.start ? parseTimecode(values.start) : null
  const end = values.end ? parseTimecode(values.end) : null
  return {
    title: values.title,
    description: emptyToUndefined(values.description),
    ...(start !== null && end !== null ? { start_ms: start, end_ms: end } : {}),
  }
}

/** `null` clears the window on the server; absent would keep it. */
export function toUpdateScene(values: SceneFormValues): UpdateScene {
  return {
    title: values.title,
    description: values.description,
    start_ms: values.start ? parseTimecode(values.start) : null,
    end_ms: values.end ? parseTimecode(values.end) : null,
  }
}

interface SceneFormProps {
  id: string
  scene?: Scene
  error?: unknown
  onSubmit: (values: SceneFormValues) => void
}

export function SceneForm({ id, scene, error, onSubmit }: SceneFormProps) {
  const form = useForm<SceneFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: scene?.title ?? "",
      description: scene?.description ?? "",
      start:
        scene?.start_ms !== null && scene?.start_ms !== undefined
          ? formatTimecode(scene.start_ms)
          : "",
      end:
        scene?.end_ms !== null && scene?.end_ms !== undefined
          ? formatTimecode(scene.end_ms)
          : "",
    },
  })
  const { errors } = form.formState
  const serverHandled = useServerFieldErrors(error, form.setError, {
    title: "title",
    description: "description",
    start_ms: "start",
    end_ms: "end",
  })

  return (
    <form id={id} onSubmit={form.handleSubmit(onSubmit)} noValidate>
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
          <Field data-invalid={!!errors.start || undefined}>
            <FieldLabel htmlFor={`${id}-start`}>Entrada</FieldLabel>
            <Input
              id={`${id}-start`}
              className="timecode"
              placeholder="00:00"
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
              placeholder="03:00"
              aria-invalid={!!errors.end || undefined}
              {...form.register("end")}
            />
            <FieldError errors={[errors.end]} />
          </Field>
        </div>
        <FieldDescription className="-mt-3">
          La ventana sitúa la escena en la película. Es opcional; si existe, los
          cues deben caer dentro.
        </FieldDescription>
        <Field data-invalid={!!errors.description || undefined}>
          <FieldLabel htmlFor={`${id}-description`}>Descripción</FieldLabel>
          <Textarea
            id={`${id}-description`}
            rows={3}
            aria-invalid={!!errors.description || undefined}
            {...form.register("description")}
          />
          <FieldError errors={[errors.description]} />
        </Field>
        {error && !serverHandled ? <ErrorState error={error} /> : null}
      </FieldGroup>
    </form>
  )
}
