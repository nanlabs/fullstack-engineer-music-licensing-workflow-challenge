import type { TenantsApi } from "./contracts"
import type { HttpClient } from "./http"
import type { ScopesCatalog, Tenant } from "./types"

export function createTenantsApi(http: HttpClient): TenantsApi {
  return {
    me: () => http.get<Tenant>("/tenants/me"),
    scopes: () => http.get<ScopesCatalog>("/scopes"),
  }
}
