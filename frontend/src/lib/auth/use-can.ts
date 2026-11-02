import { useMe } from "@/lib/queries/auth"

import { hasAnyScope, hasScope } from "./scopes"

/** Whether the signed-in user's effective scopes cover `scope`. */
export function useCan(scope: string): boolean {
  const me = useMe()
  return hasScope(me.effective_scopes, scope)
}

export function useCanAny(scopes: readonly string[]): boolean {
  const me = useMe()
  return hasAnyScope(me.effective_scopes, scopes)
}

/** The sections of the admin area and the scope that opens each. */
export const ADMIN_SCOPES = [
  "invitations:read",
  "users:read",
  "roles:read",
] as const
