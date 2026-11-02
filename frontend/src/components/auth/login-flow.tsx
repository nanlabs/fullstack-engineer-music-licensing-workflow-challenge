import { useState } from "react"

import { EmailStep } from "@/components/auth/email-step"
import { OtpForm } from "@/components/auth/otp-form"
import { TenantPicker } from "@/components/auth/tenant-picker"
import { api } from "@/lib/api"
import { isApiError } from "@/lib/api/http"
import type { MembershipOption, TokenResponse } from "@/lib/api/types"

/** The backend refuses a second code for the same purpose within a minute. */
export const RESEND_COOLDOWN_MS = 60_000

type Step =
  | { kind: "email" }
  | { kind: "tenant"; email: string; tenants: MembershipOption[] }
  | { kind: "code"; email: string; tenant: MembershipOption; resendAt: number }

interface LoginFlowProps {
  onSignedIn: (token: TokenResponse) => void | Promise<void>
}

/** Reads the `retry_after` of a 429 as a deadline, or `null` for any other error. */
export function retryDeadline(error: unknown): number | null {
  if (!isApiError(error, "OTP_TOO_MANY_REQUESTS")) return null
  const seconds = error.detail<number>("retry_after")
  return Date.now() + (typeof seconds === "number" ? seconds : 60) * 1000
}

export function LoginFlow({ onSignedIn }: LoginFlowProps) {
  const [step, setStep] = useState<Step>({ kind: "email" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState<string | null>(null)

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

  const startLogin = (email: string, tenant: MembershipOption) =>
    run(async () => {
      try {
        await api.auth.initiateLogin({ email, tenant_id: tenant.tenant_id })
        setStep({
          kind: "code",
          email,
          tenant,
          resendAt: Date.now() + RESEND_COOLDOWN_MS,
        })
      } catch (caught) {
        // A code was sent moments ago and is still valid: let the user type it.
        const deadline = retryDeadline(caught)
        if (deadline === null) throw caught
        setStep({ kind: "code", email, tenant, resendAt: deadline })
        setError(caught)
      }
    })

  const submitEmail = (email: string) =>
    run(async () => {
      setNotice(null)
      const { tenants } = await api.auth.memberships(email)
      if (tenants.length === 0) {
        setNotice(
          "Ese email no pertenece a ninguna organización. Comprueba que está bien escrito o pide una invitación."
        )
        return
      }
      if (tenants.length === 1) {
        await startLogin(email, tenants[0])
        return
      }
      setStep({ kind: "tenant", email, tenants })
    })

  const submitCode = (code: string) => {
    if (step.kind !== "code") return
    const { email, tenant } = step
    return run(async () => {
      const token = await api.auth.verifyLogin({
        email,
        tenant_id: tenant.tenant_id,
        code,
      })
      await onSignedIn(token)
    })
  }

  const resend = () => {
    if (step.kind !== "code") return
    const { email, tenant } = step
    return run(async () => {
      try {
        await api.auth.resendOtp({
          email,
          tenant_id: tenant.tenant_id,
          purpose: "login",
        })
        setStep({ ...step, resendAt: Date.now() + RESEND_COOLDOWN_MS })
      } catch (caught) {
        const deadline = retryDeadline(caught)
        if (deadline !== null) setStep({ ...step, resendAt: deadline })
        throw caught
      }
    })
  }

  const backToEmail = () => {
    setError(null)
    setNotice(null)
    setStep({ kind: "email" })
  }

  switch (step.kind) {
    case "email":
      return (
        <EmailStep
          busy={busy}
          error={error}
          notice={notice}
          onSubmit={(email) => void submitEmail(email)}
        />
      )
    case "tenant":
      return (
        <TenantPicker
          email={step.email}
          tenants={step.tenants}
          busy={busy}
          onPick={(tenant) => void startLogin(step.email, tenant)}
          onBack={backToEmail}
        />
      )
    case "code":
      return (
        <OtpForm
          email={step.email}
          resendAt={step.resendAt}
          busy={busy}
          error={error}
          onSubmit={(code) => void submitCode(code)}
          onResend={() => void resend()}
          onBack={backToEmail}
        />
      )
  }
}
