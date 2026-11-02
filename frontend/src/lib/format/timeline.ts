// Geometry of the timeline strips: where a span sits inside a window, as
// percentages the CSS can use directly, plus "nice" tick positions.

export interface TimeWindow {
  start: number
  end: number
}

export interface Span {
  start_ms: number
  end_ms: number
}

export interface Placement {
  /** Percent from the left edge of the window. */
  left: number
  /** Percent of the window width; never below `minWidth`. */
  width: number
  /** True when the span reaches outside the window and was clamped. */
  clipped: boolean
}

/**
 * The window to draw a scene in: its own bounds when it has them, otherwise
 * the envelope of its cues (so a scene without a window still shows them).
 * `null` when there is nothing to scale against.
 */
export function sceneWindow(
  scene: { start_ms: number | null; end_ms: number | null },
  spans: readonly Span[]
): TimeWindow | null {
  if (
    scene.start_ms !== null &&
    scene.end_ms !== null &&
    scene.end_ms > scene.start_ms
  ) {
    return { start: scene.start_ms, end: scene.end_ms }
  }
  if (spans.length === 0) return null
  const start = Math.min(...spans.map((s) => s.start_ms))
  const end = Math.max(...spans.map((s) => s.end_ms))
  return end > start ? { start, end } : null
}

export function placeInWindow(
  span: Span,
  window: TimeWindow,
  minWidth = 0.75
): Placement {
  const length = window.end - window.start
  if (length <= 0) return { left: 0, width: 100, clipped: false }
  const rawLeft = ((span.start_ms - window.start) / length) * 100
  const rawRight = ((span.end_ms - window.start) / length) * 100
  const left = clamp(rawLeft, 0, 100)
  const right = clamp(rawRight, 0, 100)
  const clipped = rawLeft < 0 || rawRight > 100
  const width = Math.max(right - left, minWidth)
  return { left: Math.min(left, 100 - width), width, clipped }
}

const STEPS_MS = [
  1_000, 2_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000,
  600_000, 900_000, 1_800_000, 3_600_000,
]

/** Tick positions (in ms) inside the window at a step that yields at most `maxTicks`. */
export function ticks(window: TimeWindow, maxTicks = 8): number[] {
  const length = window.end - window.start
  if (length <= 0) return [window.start]
  const step =
    STEPS_MS.find((s) => length / s <= maxTicks) ??
    STEPS_MS[STEPS_MS.length - 1]
  const first = Math.ceil(window.start / step) * step
  const result: number[] = []
  for (let t = first; t <= window.end; t += step) result.push(t)
  return result
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export interface Laned<T extends Span> {
  span: T
  /** 0-based row inside the strip; overlapping spans get different lanes. */
  lane: number
}

/** Greedy lane assignment by start time, so overlapping cues never cover each other. */
export function assignLanes<T extends Span>(spans: readonly T[]): Laned<T>[] {
  const sorted = [...spans].sort(
    (a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms
  )
  const laneEnds: number[] = []
  return sorted.map((span) => {
    let lane = laneEnds.findIndex((end) => end <= span.start_ms)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(span.end_ms)
    } else {
      laneEnds[lane] = span.end_ms
    }
    return { span, lane }
  })
}

/** The envelope of every window and span given; `null` when there is nothing. */
export function envelope(
  windows: readonly (TimeWindow | null)[],
  spans: readonly Span[]
): TimeWindow | null {
  let start = Number.POSITIVE_INFINITY
  let end = Number.NEGATIVE_INFINITY
  for (const w of windows) {
    if (!w) continue
    start = Math.min(start, w.start)
    end = Math.max(end, w.end)
  }
  for (const s of spans) {
    start = Math.min(start, s.start_ms)
    end = Math.max(end, s.end_ms)
  }
  return Number.isFinite(start) && Number.isFinite(end) && end > start
    ? { start, end }
    : null
}
