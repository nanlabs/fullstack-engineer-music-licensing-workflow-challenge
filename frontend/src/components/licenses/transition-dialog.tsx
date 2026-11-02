import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ErrorState } from "@/components/layout/error-state"
import { useServerFieldErrors } from "@/components/shared/form-helpers"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { isApiError } from "@/lib/api/http"
import type {
  LicenseEventKind,
  Track,
  TransitionRequest,
} from "@/lib/api/types"
import { fromLocalInputValue } from "@/lib/format/dates"
import {
  LICENSE_EVENT_ACTION,
  LICENSE_EVENT_DONE,
  LICENSE_SOURCE_LABEL,
  LICENSE_STATE_LABEL,
} from "@/lib/format/labels"
import { useTransitionLicense } from "@/lib/queries/licenses"
import { changeToastId } from "@/lib/realtime/realtime-provider"
import { trackKeys } from "@/lib/queries/tracks"

import { DEFAULT_SOURCE } from "./license-state"

const schema = z
  .object({
    note: z.string().trim().max(2000, "Máximo 2000 caracteres"),
    source: z.enum(["acme", "rights_holder"]),
    expires_at: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.expires_at) return
    const iso = fromLocalInputValue(v.expires_at)
    if (iso === null)
      ctx.addIssue({
        code: "custom",
        path: ["expires_at"],
        message: "Fecha no válida",
      })
    else if (new Date(iso).getTime() <= Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["expires_at"],
        message: "La fecha de caducidad debe ser futura",
      })
    }
  })
type Values = z.infer<typeof schema>

const DESCRIPTION: Record<LicenseEventKind, (track: Track) => string> = {
  request: (t) =>
    `Se pide a ${t.song.rights_holder} permiso para usar «${t.song.title}» en este cue. El cue queda congelado mientras la licencia esté activa.`,
  start_negotiation: (t) =>
    `${t.song.rights_holder} ha respondido y se negocian las condiciones.`,
  approve: () =>
    "La licencia queda concedida. Indica hasta cuándo, si el acuerdo tiene fecha de caducidad.",
  reject: () =>
    "La licencia se deniega. Podrá reabrirse más adelante para negociar de nuevo.",
  reopen: () => "Se retoma la negociación de una licencia rechazada.",
  expire: () =>
    "La licencia deja de estar vigente. No se puede volver atrás; haría falta un cue nuevo.",
}

interface TransitionDialogProps {
  track: Track
  event: LicenseEventKind | null
  onOpenChange: (open: boolean) => void
}

export function TransitionDialog({
  track,
  event,
  onOpenChange,
}: TransitionDialogProps) {
  return (
    <Dialog open={event !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {event ? (
          <TransitionForm
            track={track}
            event={event}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function TransitionForm({
  track,
  event,
  onClose,
}: {
  track: Track
  event: LicenseEventKind
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const transition = useTransitionLicense(track)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { note: "", source: DEFAULT_SOURCE[event], expires_at: "" },
  })
  const { errors } = form.formState
  const serverHandled = useServerFieldErrors(transition.error, form.setError, {
    note: "note",
    source: "source",
    expires_at: "expires_at",
  })
  const stale = isApiError(transition.error, "LICENSE_STATE_STALE")
  const formId = `transition-${event}`

  const submit = (values: Values) => {
    const body: TransitionRequest = {
      source: values.source,
      expected_state: track.license.state,
      ...(values.note ? { note: values.note } : {}),
      ...(event === "approve" && values.expires_at
        ? { expires_at: fromLocalInputValue(values.expires_at)! }
        : {}),
    }
    transition.mutate(
      { event, body },
      {
        onSuccess: (updated) => {
          toast.success(LICENSE_EVENT_DONE[event], {
            id: changeToastId(updated.id, updated.license.updated_at),
            description: `${updated.song.title} · ahora ${LICENSE_STATE_LABEL[updated.license.state].toLowerCase()}`,
          })
          onClose()
        },
      }
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{LICENSE_EVENT_ACTION[event]}</DialogTitle>
        <DialogDescription>{DESCRIPTION[event](track)}</DialogDescription>
      </DialogHeader>
      <form id={formId} onSubmit={form.handleSubmit(submit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.source || undefined}>
            <FieldLabel htmlFor={`${formId}-source`}>
              Quién lo origina
            </FieldLabel>
            <Controller
              control={form.control}
              name="source"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`${formId}-source`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acme">
                      {LICENSE_SOURCE_LABEL.acme}
                    </SelectItem>
                    <SelectItem value="rights_holder">
                      {LICENSE_SOURCE_LABEL.rights_holder}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldDescription>
              El titular de derechos no usa esta aplicación: quien registra su
              respuesta eres tú.
            </FieldDescription>
          </Field>
          {event === "approve" ? (
            <Field data-invalid={!!errors.expires_at || undefined}>
              <FieldLabel htmlFor={`${formId}-expires`}>Caduca el</FieldLabel>
              <Input
                id={`${formId}-expires`}
                type="datetime-local"
                aria-invalid={!!errors.expires_at || undefined}
                {...form.register("expires_at")}
              />
              <FieldDescription>
                Opcional. Sin fecha, la licencia solo expira si la marcas a
                mano.
              </FieldDescription>
              <FieldError errors={[errors.expires_at]} />
            </Field>
          ) : null}
          <Field data-invalid={!!errors.note || undefined}>
            <FieldLabel htmlFor={`${formId}-note`}>Nota</FieldLabel>
            <Textarea
              id={`${formId}-note`}
              rows={3}
              placeholder="Condiciones, referencia del correo, lo que convenga recordar."
              aria-invalid={!!errors.note || undefined}
              {...form.register("note")}
            />
            <FieldError errors={[errors.note]} />
          </Field>
          {transition.error && !serverHandled ? (
            <ErrorState error={transition.error} />
          ) : null}
        </FieldGroup>
      </form>
      <DialogFooter>
        {stale ? (
          <Button
            variant="outline"
            onClick={() => {
              void queryClient.invalidateQueries({
                queryKey: trackKeys.detail(track.id),
              })
              onClose()
            }}
          >
            Recargar el cue
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={onClose}
            disabled={transition.isPending}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          form={formId}
          variant={event === "reject" ? "destructive" : "default"}
          disabled={transition.isPending || stale}
        >
          {transition.isPending ? "Aplicando…" : LICENSE_EVENT_ACTION[event]}
        </Button>
      </DialogFooter>
    </>
  )
}
