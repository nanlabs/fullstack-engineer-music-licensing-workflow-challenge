import { AlertTriangleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { describeError } from "@/lib/api/errors"
import { isApiError } from "@/lib/api/http"

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  className?: string
}

/** Inline failure of a query or a mutation: what happened and what to do. */
export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const text = describeError(error)
  const requestId = isApiError(error) ? error.requestId : null
  return (
    <Alert variant="destructive" className={className} role="alert">
      <AlertTriangleIcon />
      <AlertTitle>{text.title}</AlertTitle>
      <AlertDescription>
        {text.description ? <p>{text.description}</p> : null}
        {requestId ? (
          <p className="timecode text-xs opacity-80">Referencia {requestId}</p>
        ) : null}
        {onRetry ? (
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={onRetry}
          >
            Reintentar
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
