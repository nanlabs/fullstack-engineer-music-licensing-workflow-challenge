import { USER_NAMES } from '@/api/mock/data'
import { getApiMode } from '@/api'

// In-memory cache populated from backend responses
const nameCache = new Map<string, string>()

export function cacheUserName(userId: string, name: string) {
  nameCache.set(userId, name)
}

/** Best-effort display name for a user id. Prefers a name resolved by the
 *  backend response itself (`nameHint`, e.g. `created_by_name`); falls back
 *  to the cache, then the mock seed data, then a short id fragment. */
export function userName(userId: string | null | undefined, nameHint?: string | null): string {
  if (!userId) return 'Unknown'
  if (nameHint) return nameHint
  // Check runtime cache first (populated by auth context)
  const cached = nameCache.get(userId)
  if (cached) return cached
  // In mock mode, check the hard-coded map
  if (getApiMode() === 'mock') {
    return USER_NAMES[userId] ?? `User ${userId.slice(0, 8)}`
  }
  return `User ${userId.slice(0, 8)}`
}
