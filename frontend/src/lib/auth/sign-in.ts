import type { QueryClient } from "@tanstack/react-query"

import { session } from "@/lib/api"
import type { TokenResponse } from "@/lib/api/types"
import { authQueries } from "@/lib/queries/auth"

/**
 * After a successful code: read `me` (effective scopes come from roles, which
 * the token answer does not include), arm the renewal, and hand back where
 * to go. `redirect` is only honoured when it is a path of this app.
 */
export async function completeSignIn(
  queryClient: QueryClient,
  token: TokenResponse
): Promise<void> {
  session.scheduleRefresh(token.expires_in)
  try {
    await queryClient.fetchQuery(authQueries.me())
  } catch {
    queryClient.setQueryData(authQueries.me().queryKey, {
      user: token.user,
      tenant: token.tenant,
      effective_scopes: token.user.scopes,
      session_id: null,
    })
  }
}

export function safeRedirect(redirect: string | undefined): string | null {
  if (!redirect) return null
  if (
    !redirect.startsWith("/") ||
    redirect.startsWith("//") ||
    redirect.startsWith("/login")
  )
    return null
  return redirect
}
