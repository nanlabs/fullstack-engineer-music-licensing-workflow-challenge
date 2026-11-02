import { describe, expect, it } from "vitest"

import {
  assignLanes,
  envelope,
  placeInWindow,
  sceneWindow,
  ticks,
} from "./timeline"

describe("sceneWindow", () => {
  it("uses the scene bounds when present", () => {
    expect(sceneWindow({ start_ms: 420_000, end_ms: 600_000 }, [])).toEqual({
      start: 420_000,
      end: 600_000,
    })
  })

  it("falls back to the envelope of the cues", () => {
    const spans = [
      { start_ms: 5_400_000, end_ms: 5_580_000 },
      { start_ms: 5_000_000, end_ms: 5_100_000 },
    ]
    expect(sceneWindow({ start_ms: null, end_ms: null }, spans)).toEqual({
      start: 5_000_000,
      end: 5_580_000,
    })
  })

  it("has nothing to scale against without bounds or cues", () => {
    expect(sceneWindow({ start_ms: null, end_ms: null }, [])).toBeNull()
  })
})

describe("placeInWindow", () => {
  const window = { start: 0, end: 180_000 }

  it("maps a span to percentages", () => {
    const p = placeInWindow({ start_ms: 15_000, end_ms: 95_000 }, window)
    expect(p.left).toBeCloseTo(8.333, 2)
    expect(p.width).toBeCloseTo(44.444, 2)
    expect(p.clipped).toBe(false)
  })

  it("clamps spans that reach outside the window and flags them", () => {
    const p = placeInWindow({ start_ms: -10_000, end_ms: 200_000 }, window)
    expect(p).toEqual({ left: 0, width: 100, clipped: true })
  })

  it("keeps very short spans visible", () => {
    const p = placeInWindow({ start_ms: 1_000, end_ms: 1_100 }, window)
    expect(p.width).toBe(0.75)
  })
})

describe("ticks", () => {
  it("picks a step that keeps the count small and lands on round values", () => {
    expect(ticks({ start: 0, end: 180_000 })).toEqual([
      0, 30_000, 60_000, 90_000, 120_000, 150_000, 180_000,
    ])
    expect(ticks({ start: 420_000, end: 600_000 }, 4)).toEqual([
      420_000, 480_000, 540_000, 600_000,
    ])
  })
})

describe("assignLanes", () => {
  it("stacks overlapping cues and reuses lanes that are free", () => {
    const lanes = assignLanes([
      { id: "a", start_ms: 0, end_ms: 10 },
      { id: "b", start_ms: 5, end_ms: 15 },
      { id: "c", start_ms: 10, end_ms: 20 },
      { id: "d", start_ms: 12, end_ms: 14 },
    ])
    expect(lanes.map((l) => [l.span.id, l.lane])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 0],
      ["d", 2],
    ])
  })
})

describe("envelope", () => {
  it("covers every window and span", () => {
    expect(
      envelope(
        [{ start: 0, end: 180_000 }, null],
        [{ start_ms: 5_400_000, end_ms: 5_580_000 }]
      )
    ).toEqual({
      start: 0,
      end: 5_580_000,
    })
    expect(envelope([null], [])).toBeNull()
  })
})
