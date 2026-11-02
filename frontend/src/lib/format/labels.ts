// Spanish labels for the backend's enums. Data (titles, names, emails) is
// shown as stored; only the vocabulary of the interface is translated.

import type {
  InvitationStatus,
  LicenseEventKind,
  LicenseEventSource,
  LicenseState,
  MovieStatus,
  RightsHolderKind,
  TrackUsage,
  UserStatus,
} from "@/lib/api/types"

export const LICENSE_STATE_LABEL: Record<LicenseState, string> = {
  pending: "Pendiente",
  requested: "Solicitada",
  negotiating: "En negociación",
  approved: "Aprobada",
  rejected: "Rechazada",
  expired: "Expirada",
}

/** Imperative: what the button does. */
export const LICENSE_EVENT_ACTION: Record<LicenseEventKind, string> = {
  request: "Solicitar licencia",
  start_negotiation: "Iniciar negociación",
  approve: "Aprobar",
  reject: "Rechazar",
  reopen: "Reabrir",
  expire: "Marcar como expirada",
}

/** Past: what happened, for the history and the live feed. */
export const LICENSE_EVENT_DONE: Record<LicenseEventKind, string> = {
  request: "Licencia solicitada",
  start_negotiation: "Negociación iniciada",
  approve: "Licencia aprobada",
  reject: "Licencia rechazada",
  reopen: "Negociación reabierta",
  expire: "Licencia expirada",
}

export const LICENSE_SOURCE_LABEL: Record<LicenseEventSource, string> = {
  acme: "ACME",
  rights_holder: "Titular de derechos",
  system: "Sistema",
}

export const MOVIE_STATUS_LABEL: Record<MovieStatus, string> = {
  draft: "Borrador",
  in_production: "En producción",
  released: "Estrenada",
  archived: "Archivada",
}

export const TRACK_USAGE_LABEL: Record<TrackUsage, string> = {
  background: "De fondo",
  featured: "Destacada",
}

export const RIGHTS_HOLDER_KIND_LABEL: Record<RightsHolderKind, string> = {
  artist: "Artista",
  label: "Sello",
  publisher: "Editorial",
}

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  pending: "Pendiente",
  active: "Activo",
  suspended: "Suspendido",
}

export const INVITATION_STATUS_LABEL: Record<InvitationStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  revoked: "Revocada",
  expired: "Caducada",
}

export const SCOPE_LABEL: Record<string, string> = {
  "*": "Todo",
  "users:read": "Ver usuarios",
  "users:write": "Gestionar usuarios",
  "scopes:read": "Ver permisos",
  "scopes:write": "Asignar permisos",
  "roles:read": "Ver roles",
  "roles:write": "Gestionar roles",
  "roles:assign": "Asignar roles",
  "invitations:read": "Ver invitaciones",
  "invitations:write": "Invitar",
  "tenants:read": "Ver la organización",
  "movies:read": "Ver películas",
  "movies:write": "Editar películas, escenas y cues",
  "licenses:read": "Ver licencias",
  "licenses:write": "Mover licencias",
}

export function plural(
  count: number,
  singular: string,
  pluralForm: string
): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
