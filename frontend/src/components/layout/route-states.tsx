import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router"
import { AlertTriangleIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { describeError } from "@/lib/api/errors"
import { isApiError } from "@/lib/api/http"

export function RoutePending() {
  return (
    <div
      className="flex min-h-48 items-center justify-center text-muted-foreground"
      role="status"
    >
      <Loader2Icon className="size-5 animate-spin" aria-hidden />
      <span className="sr-only">Cargando</span>
    </div>
  )
}

export function RouteNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-3 px-6 py-16">
      <h1 className="text-xl font-semibold">Esta página no existe</h1>
      <p className="text-muted-foreground">
        Comprueba la dirección o vuelve a las películas.
      </p>
      <Button asChild variant="outline">
        <Link to="/movies">Ir a películas</Link>
      </Button>
    </div>
  )
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const text = describeError(error)
  const requestId = isApiError(error) ? error.requestId : null
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-start gap-3 px-6 py-16"
      role="alert"
    >
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangleIcon className="size-5" aria-hidden />
        <h1 className="text-xl font-semibold text-foreground">{text.title}</h1>
      </div>
      {text.description ? (
        <p className="text-muted-foreground">{text.description}</p>
      ) : null}
      {requestId ? (
        <p className="timecode text-xs text-muted-foreground">
          Referencia {requestId}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          onClick={() => {
            reset()
            void router.invalidate()
          }}
        >
          Reintentar
        </Button>
        <Button asChild variant="outline">
          <Link to="/movies">Ir a películas</Link>
        </Button>
      </div>
    </div>
  )
}
