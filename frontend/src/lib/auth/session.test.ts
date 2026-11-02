import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/http"
import type { RefreshResponse } from "@/lib/api/types"

import { createSessionManager } from "./session"

const rotated: RefreshResponse = {
  access_token: "a",
  refresh_token: "r",
  token_type: "Bearer",
  expires_in: 900,
}

describe("createSessionManager", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("shares one renewal between concurrent callers", async () => {
    const refresh = vi.fn().mockResolvedValue(rotated)
    const session = createSessionManager({ refresh, locks: null })
    const results = await Promise.all([
      session.refresh(),
      session.refresh(),
      session.refresh(),
    ])
    expect(results).toEqual([true, true, true])
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("serializes renewals through the lock", async () => {
    const order: string[] = []
    const locks = {
      request: vi.fn(async (_name: string, work: () => Promise<unknown>) => {
        order.push("lock")
        return work()
      }),
    }
    const refresh = vi.fn(async () => {
      order.push("refresh")
      return rotated
    })
    const session = createSessionManager({ refresh, locks })
    await session.refresh()
    expect(order).toEqual(["lock", "refresh"])
    expect(locks.request).toHaveBeenCalledWith(
      "music-licensing:refresh",
      expect.any(Function)
    )
  })

  it("marks the session lost on a 401 and not on a network failure", async () => {
    const onLost = vi.fn()
    const refresh = vi
      .fn<() => Promise<RefreshResponse>>()
      .mockRejectedValueOnce(
        new ApiError(0, "NETWORK_ERROR", "EXTERNAL", "offline")
      )
      .mockRejectedValueOnce(
        new ApiError(401, "AUTH_INVALID_REFRESH_TOKEN", "UNAUTHORIZED", "gone")
      )
    const session = createSessionManager({ refresh, locks: null })
    session.onLost(onLost)

    expect(await session.refresh()).toBe(false)
    expect(onLost).not.toHaveBeenCalled()

    expect(await session.refresh()).toBe(false)
    expect(onLost).toHaveBeenCalledTimes(1)
  })

  it("renews a minute before the access token expires", async () => {
    const refresh = vi.fn().mockResolvedValue(rotated)
    const session = createSessionManager({ refresh, locks: null })
    session.scheduleRefresh(900)
    await vi.advanceTimersByTimeAsync(839_000)
    expect(refresh).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    // The renewal re-arms itself from the new expiry.
    await vi.advanceTimersByTimeAsync(840_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    session.cancelScheduledRefresh()
  })
})
