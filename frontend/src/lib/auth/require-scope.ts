import { ApiError } from "@/lib/api/http"
import type { Me } from "@/lib/api/types"

import { hasScope } from "./scopes"

/**
 * Route guard: throws the same 403 the backend would, so the error screen
 * explains which permission is missing instead of rendering an empty page.
 */
export function requireScope(me: Me, scope: string): void {
  if (!hasScope(me.effective_scopes, scope)) {
    throw new ApiError(403, "ACCESS_DENIED", "FORBIDDEN", "Forbidden", {
      required_scope: scope,
    })
  }
}
