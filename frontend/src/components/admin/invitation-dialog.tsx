import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ScopesEditor } from "@/components/admin/scopes-editor"
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
import { useCan } from "@/lib/auth/use-can"
import { adminQueries, useCreateInvitation } from "@/lib/queries"

const schema = z.object({
  email: z.email("Escribe un email válido"),
  role_id: z.string(),
  scopes: z.array(z.string()),
})
type Values = z.infer<typeof schema>

interface InvitationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InvitationDialog({
  open,
  onOpenChange,
}: InvitationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? <InvitationForm onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function InvitationForm({ onClose }: { onClose: () => void }) {
  const canReadRoles = useCan("roles:read")
  const canReadScopes = useCan("scopes:read")
  const roles = useQuery({ ...adminQueries.roles(), enabled: canReadRoles })
  const create = useCreateInvitation()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role_id: "none", scopes: [] },
  })
  const { errors } = form.formState
  const serverHandled = useServerFieldErrors(create.error, form.setError, {
    email: "email",
    role_id: "role_id",
    scopes: "scopes",
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Invitar a alguien</DialogTitle>
        <DialogDescription>
          Recibirá un enlace para crear su cuenta en esta organización. Caduca a
          los siete días.
        </DialogDescription>
      </DialogHeader>
      <form
        id="invitation-form"
        noValidate
        onSubmit={form.handleSubmit((values) =>
          create.mutate(
            {
              email: values.email.trim(),
              role_id: values.role_id === "none" ? undefined : values.role_id,
              scopes: values.scopes.length > 0 ? values.scopes : undefined,
            },
            {
              onSuccess: (created) => {
                toast.success("Invitación creada", {
                  description: created.delivered
                    ? `Enlace enviado a ${created.email}. En desarrollo se imprime en el log del backend (make logs).`
                    : "No se pudo entregar el enlace; reenvíala desde la lista.",
                })
                onClose()
              },
            }
          )
        )}
      >
        <FieldGroup>
          <Field data-invalid={!!errors.email || undefined}>
            <FieldLabel htmlFor="invitation-email">Email</FieldLabel>
            <Input
              id="invitation-email"
              type="email"
              autoFocus
              aria-invalid={!!errors.email || undefined}
              {...form.register("email")}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          {canReadRoles ? (
            <Field data-invalid={!!errors.role_id || undefined}>
              <FieldLabel htmlFor="invitation-role">Rol</FieldLabel>
              <Controller
                control={form.control}
                name="role_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="invitation-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin rol</SelectItem>
                      {roles.data?.roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldDescription>
                El rol se asigna al aceptar la invitación.
              </FieldDescription>
              <FieldError errors={[errors.role_id]} />
            </Field>
          ) : null}
          {canReadScopes ? (
            <Field>
              <FieldLabel>Permisos directos</FieldLabel>
              <FieldDescription>
                Además de los del rol. Puedes dejarlo vacío.
              </FieldDescription>
              <Controller
                control={form.control}
                name="scopes"
                render={({ field }) => (
                  <ScopesEditor
                    value={field.value}
                    onChange={field.onChange}
                    idPrefix="invite"
                  />
                )}
              />
            </Field>
          ) : null}
          {create.error && !serverHandled ? (
            <ErrorState error={create.error} />
          ) : null}
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={create.isPending}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="invitation-form"
          disabled={create.isPending}
        >
          {create.isPending ? "Enviando…" : "Invitar"}
        </Button>
      </DialogFooter>
    </>
  )
}
