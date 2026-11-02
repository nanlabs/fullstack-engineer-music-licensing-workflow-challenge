// Turns an `ApiError` (or anything thrown) into text for the interface:
// what happened and what to do, by error `code`. Unknown codes fall back to
// the backend's own message.

import {
  LICENSE_EVENT_ACTION,
  LICENSE_STATE_LABEL,
  plural,
} from "@/lib/format/labels"

import { ApiError, isApiError } from "./http"
import type { FieldViolation, LicenseEventKind, LicenseState } from "./types"

export interface ErrorText {
  title: string
  description?: string
}

function stateLabel(value: unknown): string {
  return typeof value === "string" && value in LICENSE_STATE_LABEL
    ? LICENSE_STATE_LABEL[value as LicenseState].toLowerCase()
    : String(value ?? "")
}

function trackCount(details: Record<string, unknown>): string {
  const ids = Array.isArray(details.track_ids) ? details.track_ids.length : 0
  return plural(ids, "cue", "cues")
}

export function describeApiError(error: ApiError): ErrorText {
  const d = error.details
  switch (error.code) {
    case "NETWORK_ERROR":
      return {
        title: "No hay conexión con el servidor",
        description:
          "Comprueba que el backend está en marcha y vuelve a intentarlo.",
      }
    case "VALIDATION_ERROR":
      return { title: "Revisa los datos", description: error.message }
    case "ACCESS_DENIED":
      return {
        title: "No tienes permiso para esta acción",
        description: d.required_scope
          ? `Hace falta el permiso ${String(d.required_scope)}.`
          : undefined,
      }
    case "ROUTE_NOT_FOUND":
      return { title: "Esa ruta no existe en el servidor" }
    case "AUTH_SESSION_EXPIRED":
      return {
        title: "Tu sesión ha caducado",
        description: "Inicia sesión de nuevo.",
      }
    case "AUTH_INVALID_REFRESH_TOKEN":
      return {
        title: "Tu sesión se cerró",
        description: "Inicia sesión de nuevo.",
      }
    case "AUTH_ACCOUNT_NOT_ACTIVE":
      return {
        title: "La cuenta no está activa",
        description: "Pide a un administrador que la reinstaure.",
      }
    case "AUTH_EMAIL_NOT_VERIFIED":
      return { title: "El email no está verificado" }
    case "AUTH_OTP_NOT_ENABLED":
      return { title: "Esta cuenta no puede entrar con código" }
    case "AUTH_FAILED":
      return { title: "No se pudo iniciar sesión", description: error.message }
    case "OTP_INVALID": {
      const left =
        typeof d.attempts_remaining === "number" ? d.attempts_remaining : null
      return {
        title: "El código no es correcto",
        description:
          left === null
            ? undefined
            : left === 0
              ? "No quedan intentos. Pide un código nuevo."
              : `${plural(left, "intento restante", "intentos restantes")}.`,
      }
    }
    case "OTP_EXPIRED":
      return { title: "El código ha caducado", description: "Pide uno nuevo." }
    case "OTP_ALREADY_USED":
      return { title: "Ese código ya se usó", description: "Pide uno nuevo." }
    case "OTP_TOO_MANY_ATTEMPTS":
      return {
        title: "Demasiados intentos",
        description: "Pide un código nuevo.",
      }
    case "OTP_TOO_MANY_REQUESTS": {
      const wait = typeof d.retry_after === "number" ? d.retry_after : null
      return {
        title: "Espera antes de pedir otro código",
        description: wait === null ? undefined : `Podrás pedirlo en ${wait} s.`,
      }
    }
    case "INVITATION_INVALID":
      return {
        title: "La invitación no es válida",
        description: "Comprueba el enlace o pide una nueva.",
      }
    case "INVITATION_NOT_FOUND":
      return { title: "La invitación no existe" }
    case "INVITATION_NOT_PENDING":
      return {
        title: "La invitación ya no está pendiente",
        description:
          "Se aceptó, se revocó o caducó. Pide una nueva si la necesitas.",
      }
    case "INVITATION_MEMBER_NOT_ELIGIBLE":
      return {
        title: "Este email ya pertenece a la organización",
        description: "Entra con tu cuenta en lugar de aceptar la invitación.",
      }
    case "INVITATION_ALREADY_PENDING":
      return {
        title: "Ya hay una invitación pendiente para este email",
        description: "Reenvíala o revócala desde la lista.",
      }
    case "USER_NOT_FOUND":
      return { title: "El usuario no existe" }
    case "USER_INVALID_STATUS":
      return {
        title: "El estado del usuario no permite esa acción",
        description: error.message,
      }
    case "USER_CANNOT_MODIFY_SELF":
      return { title: "No puedes cambiar tu propia cuenta" }
    case "ROLE_NOT_FOUND":
      return { title: "El rol no existe" }
    case "ROLE_ALREADY_EXISTS":
      return { title: "Ya existe un rol con ese nombre" }
    case "TENANT_NOT_FOUND":
      return { title: "La organización no existe" }
    case "MOVIE_NOT_FOUND":
      return { title: "La película no existe" }
    case "MOVIE_HAS_ACTIVE_LICENSES":
      return {
        title: "La película tiene licencias activas",
        description: `${trackCount(d)} con licencia solicitada, en negociación o aprobada. Recházalas o márcalas como expiradas antes de eliminar.`,
      }
    case "SCENE_NOT_FOUND":
      return { title: "La escena no existe" }
    case "SCENE_HAS_ACTIVE_LICENSES":
      return {
        title: "La escena tiene licencias activas",
        description: `${trackCount(d)} con licencia solicitada, en negociación o aprobada. Recházalas o márcalas como expiradas antes de eliminar.`,
      }
    case "SCENE_WINDOW_CONFLICT":
      return {
        title: "La ventana deja cues fuera",
        description: `${trackCount(d)} quedarían fuera de la nueva ventana. Mueve esos cues o amplía la ventana.`,
      }
    case "SCENE_ORDER_STALE":
      return {
        title: "El orden de escenas cambió",
        description:
          "Alguien reordenó las escenas mientras tanto. Recarga y vuelve a intentarlo.",
      }
    case "SONG_NOT_FOUND":
      return { title: "La canción no existe" }
    case "SONG_ISRC_TAKEN":
      return { title: "Ese ISRC ya está en otra canción" }
    case "SONG_IN_USE":
      return {
        title: "La canción está colocada en algún cue",
        description: "Quita esos cues antes de eliminarla.",
      }
    case "TRACK_NOT_FOUND":
      return { title: "El cue no existe" }
    case "TRACK_LOCKED_BY_LICENSE":
      return {
        title: "El cue está congelado por su licencia",
        description: `La licencia está ${stateLabel(d.state)}. Recházala o márcala como expirada antes de cambiar el cue.`,
      }
    case "LICENSE_INVALID_TRANSITION": {
      const allowed = Array.isArray(d.allowed_events)
        ? (d.allowed_events as LicenseEventKind[]).map(
            (e) => LICENSE_EVENT_ACTION[e] ?? e
          )
        : []
      return {
        title: "La licencia no admite esa acción",
        description:
          allowed.length > 0
            ? `Está ${stateLabel(d.state)}; ahora puedes: ${allowed.join(", ").toLowerCase()}.`
            : `Está ${stateLabel(d.state)} y no admite más cambios.`,
      }
    }
    case "LICENSE_STATE_STALE":
      return {
        title: "La licencia cambió",
        description: `Ahora está ${stateLabel(d.state)}. Revisa el estado y vuelve a intentarlo.`,
      }
  }
  switch (error.kind) {
    case "UNAUTHORIZED":
      return {
        title: "Tu sesión no es válida",
        description: "Inicia sesión de nuevo.",
      }
    case "FORBIDDEN":
      return {
        title: "No tienes permiso para esta acción",
        description: error.message,
      }
    case "NOT_FOUND":
      return {
        title: "No se encontró lo que buscabas",
        description: error.message,
      }
    case "RATE_LIMITED":
      return {
        title: "Demasiadas peticiones",
        description: "Espera un momento y vuelve a intentarlo.",
      }
    case "VALIDATION":
    case "CONFLICT":
    case "BUSINESS":
      return { title: error.message }
    case "EXTERNAL":
    case "INTERNAL":
      return { title: "Algo falló en el servidor", description: error.message }
  }
}

export function describeError(error: unknown): ErrorText {
  if (isApiError(error)) return describeApiError(error)
  if (error instanceof Error && error.message) {
    return { title: "Algo salió mal", description: error.message }
  }
  return { title: "Algo salió mal" }
}

/**
 * Field-level messages of a 400 `VALIDATION_ERROR`, one per field, for
 * `setError` in forms. Also covers the single `details.field` variant.
 */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error, "VALIDATION_ERROR")) return {}
  const out: Record<string, string> = {}
  const fields = error.details.fields
  if (fields && typeof fields === "object") {
    for (const [name, violations] of Object.entries(
      fields as Record<string, FieldViolation[]>
    )) {
      const first = Array.isArray(violations) ? violations[0] : undefined
      out[name] = first?.message ?? "Valor no válido"
    }
  } else if (typeof error.details.field === "string") {
    out[error.details.field] = error.message
  }
  return out
}
