import { useEffect } from "react"
import type { FieldValues, Path, UseFormSetError } from "react-hook-form"

import { fieldErrors } from "@/lib/api/errors"

/**
 * Pushes the backend's field messages into the form once per error, mapping
 * API field names to form field names. Returns `true` when at least one
 * landed on a known field, so the caller can skip the generic error banner.
 */
export function useServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  map: Record<string, Path<T>>
): boolean {
  const messages = fieldErrors(error)
  const matched = Object.keys(messages).filter((name) => name in map)

  useEffect(() => {
    if (!error) return
    const current = fieldErrors(error)
    for (const [apiName, formName] of Object.entries(map)) {
      const message = current[apiName]
      if (message) setError(formName, { type: "server", message })
    }
    // `map` is a literal at every call site; the error identity drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, setError])

  return matched.length > 0
}

/** `""` → undefined for optional text fields the API treats as absent. */
export function emptyToUndefined(
  value: string | undefined | null
): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
