// The one place that wires the HTTP client, the domain implementations and
// the session manager together. Screens import `api`; the query layer
// (`@/lib/queries`) wraps it for TanStack Query.

import { createSessionManager } from "@/lib/auth/session"

import { createAuthApi } from "./auth"
import type { Api } from "./contracts"
import { createHttpClient, type HttpClient } from "./http"
import { createInvitationsApi } from "./invitations"
import { createLicensesApi } from "./licenses"
import { createMoviesApi } from "./movies"
import { createRolesApi } from "./roles"
import { createScenesApi } from "./scenes"
import { createSongsApi } from "./songs"
import { createTenantsApi } from "./tenants"
import { createTracksApi } from "./tracks"
import { createUsersApi } from "./users"

/** Same-origin; Vite proxies it in development and nginx in the image. */
export const API_BASE = "/api/v1"

export function createApi(http: HttpClient): Api {
  return {
    auth: createAuthApi(http),
    tenants: createTenantsApi(http),
    users: createUsersApi(http),
    roles: createRolesApi(http),
    invitations: createInvitationsApi(http),
    movies: createMoviesApi(http),
    scenes: createScenesApi(http),
    tracks: createTracksApi(http),
    licenses: createLicensesApi(http),
    songs: createSongsApi(http),
  }
}

// `session` is referenced lazily by the client (only on a 401), so the
// three can depend on each other without an initialisation order problem.
export const http: HttpClient = createHttpClient({
  baseUrl: API_BASE,
  renewSession: () => session.refresh(),
})

export const api: Api = createApi(http)

export const session = createSessionManager({
  refresh: () => api.auth.refresh(),
})

export { ApiError, isApiError } from "./http"
export { describeError, fieldErrors } from "./errors"
export type * from "./types"
export type * from "./contracts"
