import type { RolesApi } from "./contracts"
import type { HttpClient } from "./http"
import type { Role, RoleList } from "./types"

const path = (id: string, rest = "") =>
  `/roles/${encodeURIComponent(id)}${rest}`

export function createRolesApi(http: HttpClient): RolesApi {
  return {
    list: () => http.get<RoleList>("/roles"),
    get: (id) => http.get<Role>(path(id)),
    create: (body) => http.post<Role>("/roles", { body }),
    update: (id, body) => http.put<Role>(path(id), { body }),
    remove: (id) => http.delete(path(id)),
    assign: (roleId, userId) =>
      http.post<void>(path(roleId, "/users"), { body: { user_id: userId } }),
    unassign: (roleId, userId) =>
      http.delete(path(roleId, `/users/${encodeURIComponent(userId)}`)),
  }
}
