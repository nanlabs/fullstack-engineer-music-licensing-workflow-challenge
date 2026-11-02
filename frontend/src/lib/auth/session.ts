// Keeps the cookie session alive. The backend rotates the refresh token on
// every use and revokes the whole session when one is presented twice, so a
// renewal must happen once at a time: concurrent callers in this tab share
// one in-flight promise, and tabs take turns through the Web Locks API
// (the cookie jar is shared between them).

import { isApiError } from "@/lib/api/http"
import type { RefreshResponse } from "@/lib/api/types"

export const REFRESH_LOCK = "music-licensing:refresh"

/** Renew this long before the access token expires. */
const LEAD_MS = 60_000
const MIN_DELAY_MS = 5_000

/** The slice of the Web Locks API the manager uses (`navigator.locks`). */
export interface LockLike {
  request(name: string, callback: () => Promise<unknown>): Promise<unknown>
}

export interface SessionDeps {
  refresh(): Promise<RefreshResponse>
  /** Defaults to `navigator.locks`; `null` disables cross-tab serialization. */
  locks?: LockLike | null
}

export interface SessionManager {
  /**
   * Renews the session. Resolves `true` when the cookies were rotated and
   * `false` when they could not be; a 401 also marks the session as lost.
   */
  refresh(): Promise<boolean>
  /** Arms a renewal shortly before an access token of `expiresInSeconds` expires. */
  scheduleRefresh(expiresInSeconds: number): void
  cancelScheduledRefresh(): void
  /** Subscribes to the moment the session can no longer be renewed. */
  onLost(listener: () => void): () => void
}

export function createSessionManager(deps: SessionDeps): SessionManager {
  const locks =
    deps.locks === undefined
      ? typeof navigator !== "undefined"
        ? navigator.locks
        : null
      : deps.locks
  const listeners = new Set<() => void>()
  let inflight: Promise<boolean> | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  function withLock<T>(work: () => Promise<T>): Promise<T> {
    return locks ? (locks.request(REFRESH_LOCK, work) as Promise<T>) : work()
  }

  function lost() {
    cancelScheduledRefresh()
    for (const listener of listeners) listener()
  }

  async function renew(): Promise<boolean> {
    try {
      const response = await withLock(() => deps.refresh())
      scheduleRefresh(response.expires_in)
      return true
    } catch (error) {
      if (isApiError(error) && error.status === 401) lost()
      return false
    }
  }

  function refresh(): Promise<boolean> {
    inflight ??= renew().finally(() => {
      inflight = null
    })
    return inflight
  }

  function scheduleRefresh(expiresInSeconds: number) {
    cancelScheduledRefresh()
    const delay = Math.max(expiresInSeconds * 1000 - LEAD_MS, MIN_DELAY_MS)
    timer = setTimeout(() => void refresh(), delay)
  }

  function cancelScheduledRefresh() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  return {
    refresh,
    scheduleRefresh,
    cancelScheduledRefresh,
    onLost(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
