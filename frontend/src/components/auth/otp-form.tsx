import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useState } from "react"

import { ErrorState } from "@/components/layout/error-state"
import { Button } from "@/components/ui/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { useCountdown } from "@/hooks/use-countdown"

export const OTP_LENGTH = 6

interface OtpFormProps {
  /** Where the code went. */
  email: string
  /** Epoch ms until which "Reenviar" stays disabled. */
  resendAt: number | null
  busy: boolean
  error: unknown
  onSubmit: (code: string) => void
  onResend: () => void
  onBack?: () => void
}

export function OtpForm({
  email,
  resendAt,
  busy,
  error,
  onSubmit,
  onResend,
  onBack,
}: OtpFormProps) {
  const [code, setCode] = useState("")
  const wait = useCountdown(resendAt)

  // A fresh error means the code was wrong: clear it so the next one types from the start.
  const [seenError, setSeenError] = useState(error)
  if (error !== seenError) {
    setSeenError(error)
    if (error) setCode("")
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (code.length === OTP_LENGTH) onSubmit(code)
      }}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Introduce el código
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enviamos un código de seis dígitos a{" "}
          <span className="text-foreground">{email}</span>. Caduca en diez
          minutos.
        </p>
      </div>

      <InputOTP
        maxLength={OTP_LENGTH}
        pattern={REGEXP_ONLY_DIGITS}
        value={code}
        onChange={setCode}
        onComplete={(value: string) => onSubmit(value)}
        disabled={busy}
        autoFocus
        aria-label="Código de un solo uso"
        containerClassName="justify-start"
      >
        <InputOTPGroup>
          {Array.from({ length: OTP_LENGTH }, (_, i) => (
            <InputOTPSlot key={i} index={i} className="size-11 text-lg" />
          ))}
        </InputOTPGroup>
      </InputOTP>

      {error ? <ErrorState error={error} /> : null}

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={busy || code.length !== OTP_LENGTH}>
          {busy ? "Comprobando…" : "Entrar"}
        </Button>
        <div className="flex items-center justify-between text-sm">
          {onBack ? (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-muted-foreground"
              onClick={onBack}
            >
              Cambiar de email
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={onResend}
            disabled={busy || wait > 0}
          >
            {wait > 0 ? `Reenviar código en ${wait} s` : "Reenviar código"}
          </Button>
        </div>
      </div>

      {import.meta.env.DEV ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          En desarrollo el código no se envía por email: se imprime en el log
          del backend (<code>make logs</code>).
        </p>
      ) : null}
    </form>
  )
}
