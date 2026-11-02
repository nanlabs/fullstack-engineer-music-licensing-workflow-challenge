import { zodResolver } from "@hookform/resolvers/zod"
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
import type { Role } from "@/lib/api/types"
import { useCreateRole, useUpdateRole } from "@/lib/queries"

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Al menos dos caracteres")
    .max(64, "Máximo 64 caracteres"),
  description: z.string().trim().max(500, "Máximo 500 caracteres"),
  scopes: z.array(z.string()),
})
type Values = z.infer<typeof schema>

interface RoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: Role
}

export function RoleDialog({ open, onOpenChange, role }: RoleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <RoleForm role={role} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function RoleForm({ role, onClose }: { role?: Role; onClose: () => void }) {
  const create = useCreateRole()
  const update = useUpdateRole(role?.id ?? "")
  const mutation = role ? update : create
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
      scopes: role?.scopes ?? [],
    },
  })
  const { errors } = form.formState
  const serverHandled = useServerFieldErrors(mutation.error, form.setError, {
    name: "name",
    description: "description",
    scopes: "scopes",
  })
  const formId = role ? `role-form-${role.id}` : "role-form-new"

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {role ? `Editar rol ${role.name}` : "Nuevo rol"}
        </DialogTitle>
        <DialogDescription>
          Un rol agrupa permisos; quien lo tenga asignado los hereda al momento.
        </DialogDescription>
      </DialogHeader>
      <form
        id={formId}
        noValidate
        onSubmit={form.handleSubmit((values) =>
          mutation.mutate(
            {
              name: values.name,
              description: values.description,
              scopes: values.scopes,
            },
            {
              onSuccess: () => {
                toast.success(role ? "Rol guardado" : "Rol creado")
                onClose()
              },
            }
          )
        )}
      >
        <FieldGroup>
          <Field data-invalid={!!errors.name || undefined}>
            <FieldLabel htmlFor={`${formId}-name`}>Nombre</FieldLabel>
            <Input
              id={`${formId}-name`}
              autoFocus
              placeholder="licensing-manager"
              aria-invalid={!!errors.name || undefined}
              {...form.register("name")}
            />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.description || undefined}>
            <FieldLabel htmlFor={`${formId}-description`}>
              Descripción
            </FieldLabel>
            <Input
              id={`${formId}-description`}
              aria-invalid={!!errors.description || undefined}
              {...form.register("description")}
            />
            <FieldError errors={[errors.description]} />
          </Field>
          <Field>
            <FieldLabel>Permisos</FieldLabel>
            <FieldDescription>
              Solo puedes conceder permisos que tú también tienes.
            </FieldDescription>
            <Controller
              control={form.control}
              name="scopes"
              render={({ field }) => (
                <ScopesEditor
                  value={field.value}
                  onChange={field.onChange}
                  idPrefix={formId}
                />
              )}
            />
          </Field>
          {mutation.error && !serverHandled ? (
            <ErrorState error={mutation.error} />
          ) : null}
        </FieldGroup>
      </form>
      <DialogFooter>
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
            : role
              ? "Guardar cambios"
              : "Crear rol"}
        </Button>
      </DialogFooter>
    </>
  )
}
