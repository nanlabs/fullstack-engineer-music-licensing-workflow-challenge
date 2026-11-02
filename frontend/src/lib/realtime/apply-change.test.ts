import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import type { ListOf, Track } from "@/lib/api/types"
import { licenseKeys } from "@/lib/queries/licenses"
import { trackKeys } from "@/lib/queries/tracks"
import { licenseChanged, scene, track } from "@/test/fixtures"

import { applyLicenseChange, applyResync } from "./apply-change"

const list = (...items: Track[]): ListOf<Track> => ({
  items,
  count: items.length,
})

describe("applyLicenseChange", () => {
  it("replaces the track in the detail and in every list that holds it", () => {
    const qc = new QueryClient()
    const before = track({ state: "pending" })
    const other = track({ id: "other", state: "approved" })
    const after = track({ state: "requested" })
    qc.setQueryData(trackKeys.detail(before.id), before)
    qc.setQueryData(trackKeys.byScene(scene.id), list(other, before))
    qc.setQueryData(trackKeys.byMovie(before.movie_id), list(before))

    applyLicenseChange(qc, licenseChanged(after))

    expect(
      qc.getQueryData<Track>(trackKeys.detail(before.id))?.license.state
    ).toBe("requested")
    expect(
      qc
        .getQueryData<ListOf<Track>>(trackKeys.byScene(scene.id))
        ?.items.map((t) => t.license.state)
    ).toEqual(["approved", "requested"])
    expect(
      qc.getQueryData<ListOf<Track>>(trackKeys.byMovie(before.movie_id))
        ?.items[0].license.state
    ).toBe("requested")
  })

  it("invalidates a list that should hold the track but does not, and the history", () => {
    const qc = new QueryClient()
    const next = track({ state: "requested" })
    qc.setQueryData(trackKeys.byScene(scene.id), list())
    qc.setQueryData(licenseKeys.history(next.id), { items: [], count: 0 })

    applyLicenseChange(qc, licenseChanged(next))

    expect(qc.getQueryState(trackKeys.byScene(scene.id))?.isInvalidated).toBe(
      true
    )
    expect(qc.getQueryState(licenseKeys.history(next.id))?.isInvalidated).toBe(
      true
    )
  })

  it("drops the track from a filtered list its new state no longer matches", () => {
    const qc = new QueryClient()
    const pending = track({ state: "pending" })
    qc.setQueryData(
      trackKeys.byScene(scene.id, { state: "pending" }),
      list(pending)
    )
    qc.setQueryData(trackKeys.byScene(scene.id, { state: "requested" }), list())

    applyLicenseChange(qc, licenseChanged(track({ state: "requested" })))

    expect(
      qc.getQueryData<ListOf<Track>>(
        trackKeys.byScene(scene.id, { state: "pending" })
      )
    ).toEqual(list())
    expect(
      qc.getQueryState(trackKeys.byScene(scene.id, { state: "requested" }))
        ?.isInvalidated
    ).toBe(true)
  })

  it("resync invalidates tracks and licenses", () => {
    const qc = new QueryClient()
    qc.setQueryData(trackKeys.byMovie("m"), list())
    qc.setQueryData(licenseKeys.history("t"), { items: [], count: 0 })
    applyResync(qc)
    expect(qc.getQueryState(trackKeys.byMovie("m"))?.isInvalidated).toBe(true)
    expect(qc.getQueryState(licenseKeys.history("t"))?.isInvalidated).toBe(true)
  })
})
