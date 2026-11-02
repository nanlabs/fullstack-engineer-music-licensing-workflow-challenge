import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { ErrorState } from "@/components/layout/error-state"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const schema = z.object({
  email: z.email("Escribe un email válido"),
})
type Values = z.infer<typeof schema>

interface EmailStepProps {
  defaultEmail?: string
  busy: boolean
  error: unknown
  /** A non-error message to show under the field (e.g. unknown email). */
  notice?: string | null
  onSubmit: (email: string) => void
}

export function EmailStep({
  defaultEmail = "",
  busy,
  error,
  notice,
  onSubmit,
}: EmailStepProps) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: defaultEmail },
  })
  const emailError = form.formState.errors.email

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit((values) => onSubmit(values.email.trim()))}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Entra con tu email
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Te enviaremos un código de un solo uso. Sin contraseñas.
        </p>
      </div>
      <Field data-invalid={!!emailError || undefined}>
        <FieldLabel htmlFor="login-email">Email</FieldLabel>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="nombre@acme.test"
          aria-invalid={!!emailError || undefined}
          {...form.register("email")}
        />
        <FieldError errors={[emailError]} />
        {notice ? (
          <p className="text-sm text-muted-foreground">{notice}</p>
        ) : null}
      </Field>
      {error ? <ErrorState error={error} /> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Buscando…" : "Continuar"}
      </Button>
    </form>
  )
}
