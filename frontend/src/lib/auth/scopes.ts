// Mirrors the backend's scope matching (`iam::scope`): a grant covers a
// required scope when it is identical, the wildcard `*`, or `family:*` for
// the same family. The UI only hides what the user cannot do; the backend
// still decides.

export function grantCovers(grant: string, required: string): boolean {
  if (grant === "*" || grant === required) return true
  if (grant.endsWith(":*")) {
    const family = grant.slice(0, -2)
    return required.startsWith(`${family}:`)
  }
  return false
}

export function hasScope(
  effective: readonly string[],
  required: string
): boolean {
  return effective.some((grant) => grantCovers(grant, required))
}

export function hasAnyScope(
  effective: readonly string[],
  required: readonly string[]
): boolean {
  return required.some((scope) => hasScope(effective, scope))
}
