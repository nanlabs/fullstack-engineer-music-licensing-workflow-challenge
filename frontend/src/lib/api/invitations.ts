import type { InvitationsApi } from "./contracts"
import type { HttpClient } from "./http"
import type { CreatedInvitation, Invitation, Paginated } from "./types"

const path = (id: string, rest = "") =>
  `/invitations/${encodeURIComponent(id)}${rest}`

export function createInvitationsApi(http: HttpClient): InvitationsApi {
  return {
    list: (filter) =>
      http.get<Paginated<Invitation>>("/invitations", { query: { ...filter } }),
    get: (id) => http.get<Invitation>(path(id)),
    create: (body) => http.post<CreatedInvitation>("/invitations", { body }),
    resend: (id) => http.post<CreatedInvitation>(path(id, "/resend")),
    revoke: (id) => http.post<Invitation>(path(id, "/revoke")),
  }
}
