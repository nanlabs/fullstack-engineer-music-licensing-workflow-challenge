import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { CheckCircle2Icon, Loader2Icon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { OtpForm } from "@/components/auth/otp-form"
import { RESEND_COOLDOWN_MS, retryDeadline } from "@/components/auth/login-flow"
import { ErrorState } from "@/components/layout/error-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useCountdown } from "@/hooks/use-countdown"
import { api } from "@/lib/api"
import type { InvitationPreview, TokenResponse } from "@/lib/api/types"
import { formatRelative } from "@/lib/format/dates"

const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre (al menos dos caracteres)")
    .max(120, "Máximo 120 caracteres"),
})
type NameValues = z.infer<typeof nameSchema>

type Step =
  | { kind: "name" }
  | { kind: "signup-code"; name: string; tenantId: string; resendAt: number }
  | { kind: "created"; tenantId: string; retryAt: number | null }
  | { kind: "login-code"; tenantId: string; resendAt: number }

interface InvitationFlowProps {
  token: string | null
  onSignedIn: (token: TokenResponse) => void | Promise<void>
}

export function InvitationFlow({ token, onSignedIn }: InvitationFlowProps) {
  const preview = useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: () => api.auth.lookupInvitation(token ?? ""),
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
  })

  if (token === null) {
    return (
      <Notice title="El enlace no es completo">
        Falta el token de la invitación. Abre el enlace tal como lo recibiste o
        pide una invitación nueva.
      </Notice>
    )
  }
  if (preview.isPending) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2Icon className="size-4 animate-spin" aria-hidden /> Comprobando
        la invitación…
      </div>
    )
  }
  if (preview.isError) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorState error={preview.error} />
        <Button asChild variant="outline" className="self-start">
          <Link to="/login">Ir al inicio de sesión</Link>
        </Button>
      </div>
    )
  }
  return <Accept token={token} preview={preview.data} onSignedIn={onSignedIn} />
}

function Notice({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{children}</p>
      </div>
      <Button asChild variant="outline" className="self-start">
        <Link to="/login">Ir al inicio de sesión</Link>
      </Button>
    </div>
  )
}

function Accept({
  token,
  preview,
  onSignedIn,
}: {
  token: string
  preview: InvitationPreview
  onSignedIn: InvitationFlowProps["onSignedIn"]
}) {
  const [step, setStep] = useState<Step>({ kind: "name" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const form = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: "" },
  })
  const nameError = form.formState.errors.name
  const retryWait = useCountdown(step.kind === "created" ? step.retryAt : null)

  async function run(work: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (caught) {
      setError(caught)
    } finally {
      setBusy(false)
    }
  }

  const submitName = ({ name }: NameValues) =>
    run(async () => {
      const res = await api.auth.initiateSignup({
        email: preview.email,
        name,
        invitation_token: token,
      })
      setStep({
        kind: "signup-code",
        name,
        tenantId: res.tenant_id,
        resendAt: Date.now() + RESEND_COOLDOWN_MS,
      })
    })

  const requestLoginCode = (tenantId: string) =>
    run(async () => {
      try {
        await api.auth.initiateLogin({
          email: preview.email,
          tenant_id: tenantId,
        })
        setStep({
          kind: "login-code",
          tenantId,
          resendAt: Date.now() + RESEND_COOLDOWN_MS,
        })
      } catch (caught) {
        const deadline = retryDeadline(caught)
        if (deadline === null) throw caught
        setStep({ kind: "created", tenantId, retryAt: deadline })
      }
    })

  const submitSignupCode = (code: string) => {
    if (step.kind !== "signup-code") return
    const { name, tenantId } = step
    return run(async () => {
      await api.auth.verifySignup({
        email: preview.email,
        name,
        invitation_token: token,
        tenant_id: tenantId,
        code,
      })
      setStep({ kind: "created", tenantId, retryAt: null })
      await requestLoginCode(tenantId)
    })
  }

  const submitLoginCode = (code: string) => {
    if (step.kind !== "login-code") return
    const { tenantId } = step
    return run(async () => {
      const result = await api.auth.verifyLogin({
        email: preview.email,
        tenant_id: tenantId,
        code,
      })
      await onSignedIn(result)
    })
  }

  const resend = () => {
    if (step.kind !== "signup-code" && step.kind !== "login-code") return
    const current = step
    return run(async () => {
      try {
        await api.auth.resendOtp({
          email: preview.email,
          tenant_id: current.tenantId,
          purpose: current.kind === "signup-code" ? "signup" : "login",
          ...(current.kind === "signup-code"
            ? { invitation_token: token }
            : {}),
        })
        setStep({ ...current, resendAt: Date.now() + RESEND_COOLDOWN_MS })
      } catch (caught) {
        const deadline = retryDeadline(caught)
        if (deadline !== null) setStep({ ...current, resendAt: deadline })
        throw caught
      }
    })
  }

  const header = (
    <Card className="mb-5">
      <CardContent className="flex flex-col gap-1 text-sm">
        <p>
          <span className="font-medium">{preview.invited_by_name}</span> te
          invita a <span className="font-medium">{preview.tenant_name}</span>.
        </p>
        <p className="text-muted-foreground">
          Para <span className="text-foreground">{preview.email}</span>. Caduca{" "}
          {formatRelative(preview.expires_at)}.
        </p>
      </CardContent>
    </Card>
  )

  switch (step.kind) {
    case "name":
      return (
        <div>
          {header}
          <form
            className="flex flex-col gap-5"
            onSubmit={form.handleSubmit((v) => void submitName(v))}
          >
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Crea tu cuenta
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Solo falta tu nombre. Después verificaremos el email con un
                código.
              </p>
            </div>
            <Field data-invalid={!!nameError || undefined}>
              <FieldLabel htmlFor="signup-name">Nombre</FieldLabel>
              <Input
                id="signup-name"
                autoComplete="name"
                autoFocus
                aria-invalid={!!nameError || undefined}
                {...form.register("name")}
              />
              <FieldDescription>
                Como quieres aparecer en el historial de licencias.
              </FieldDescription>
              <FieldError errors={[nameError]} />
            </Field>
            {error ? <ErrorState error={error} /> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Enviando código…" : "Continuar"}
            </Button>
          </form>
        </div>
      )
    case "signup-code":
      return (
        <div>
          {header}
          <OtpForm
            email={preview.email}
            resendAt={step.resendAt}
            busy={busy}
            error={error}
            onSubmit={(code) => void submitSignupCode(code)}
            onResend={() => void resend()}
          />
        </div>
      )
    case "created":
      return (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <CheckCircle2Icon
              className="mt-0.5 size-5 shrink-0 text-license-approved"
              aria-hidden
            />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Cuenta creada
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ya formas parte de {preview.tenant_name}. Para entrar te
                enviaremos un código de acceso.
              </p>
            </div>
          </div>
          {error ? <ErrorState error={error} /> : null}
          <Button
            onClick={() => void requestLoginCode(step.tenantId)}
            disabled={busy || retryWait > 0}
          >
            {busy
              ? "Enviando código…"
              : retryWait > 0
                ? `Pedir código de acceso en ${retryWait} s`
                : "Pedir código de acceso"}
          </Button>
        </div>
      )
    case "login-code":
      return (
        <OtpForm
          email={preview.email}
          resendAt={step.resendAt}
          busy={busy}
          error={error}
          onSubmit={(code) => void submitLoginCode(code)}
          onResend={() => void resend()}
        />
      )
  }
}
