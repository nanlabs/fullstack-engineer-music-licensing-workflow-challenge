import type { UsersApi } from "./contracts"
import type { HttpClient } from "./http"
import type { Paginated, User, UserRoles } from "./types"

const path = (id: string, rest = "") =>
  `/users/${encodeURIComponent(id)}${rest}`

export function createUsersApi(http: HttpClient): UsersApi {
  return {
    list: (query) =>
      http.get<Paginated<User>>("/users", { query: { ...query } }),
    get: (id) => http.get<User>(path(id)),
    suspend: (id) => http.post<User>(path(id, "/suspend")),
    reinstate: (id) => http.post<User>(path(id, "/reinstate")),
    setScopes: (id, scopes) =>
      http.put<User>(path(id, "/scopes"), { body: { scopes } }),
    roles: (id) => http.get<UserRoles>(path(id, "/roles")),
  }
}
