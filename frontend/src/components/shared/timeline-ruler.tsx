import { useLayoutEffect, useRef, useState, type RefObject } from "react"

import { formatTimecode } from "@/lib/format/timecode"
import { placeInWindow, ticks, type TimeWindow } from "@/lib/format/timeline"
import { cn } from "@/lib/utils"

interface TimelineRulerProps {
  window: TimeWindow
  /** Upper bound on tick count; the measured width lowers it further. */
  maxTicks?: number
  className?: string
}

/** Room one timecode label needs, and the gap kept between two of them. */
const LABEL_PX = 48
const GAP_PX = 6
/** Pixels of strip per tick before labels start to crowd. */
const SLOT_PX = 72

/**
 * Tick marks with timecodes along a window; the mono face appears only here.
 * The strip is measured so the tick count follows the width, and a label
 * that would land on its neighbour is dropped (its mark stays).
 */
interface Mark {
  t: number
  left: number
  alignRight: boolean
  labelled: boolean
}

/** Places the ticks and decides which labels fit; pure, so the render stays declarative. */
function layoutMarks(
  window: TimeWindow,
  maxTicks: number,
  width: number
): Mark[] {
  const budget = width > 0 ? Math.max(2, Math.floor(width / SLOT_PX)) : maxTicks
  const result: Mark[] = []
  let previousEnd = Number.NEGATIVE_INFINITY
  for (const t of ticks(window, Math.min(maxTicks, budget))) {
    const { left } = placeInWindow({ start_ms: t, end_ms: t }, window, 0)
    const px = width > 0 ? (left / 100) * width : null
    const alignRight = px === null ? left > 92 : px + LABEL_PX > width
    const start = px === null ? null : alignRight ? px - LABEL_PX : px
    const labelled = start === null || start >= previousEnd + GAP_PX
    if (labelled && start !== null) previousEnd = start + LABEL_PX
    result.push({ t, left, alignRight, labelled })
  }
  return result
}

/**
 * Tick marks with timecodes along a window; the mono face appears only here.
 * The strip is measured so the tick count follows the width, and a label
 * that would land on its neighbour is dropped (its mark stays).
 */
export function TimelineRuler({
  window,
  maxTicks = 8,
  className,
}: TimelineRulerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const width = useElementWidth(ref)
  const marks = layoutMarks(window, maxTicks, width)
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("relative h-5 border-b border-border", className)}
    >
      {marks.map(({ t, left, alignRight, labelled }) => (
        <span
          key={t}
          className="absolute bottom-0 flex h-full flex-col justify-end"
          style={{
            left: `${left}%`,
            transform: alignRight ? "translateX(-100%)" : undefined,
          }}
        >
          {labelled ? (
            <span
              className={cn(
                "timecode text-[10px] leading-none text-muted-foreground",
                alignRight ? "pr-1" : "pl-1"
              )}
            >
              {formatTimecode(t)}
            </span>
          ) : null}
          <span
            className={cn(
              "mt-0.5 h-1.5 w-px bg-border",
              alignRight && "self-end"
            )}
          />
        </span>
      ))}
    </div>
  )
}

/** The element's current inline width, 0 until measured (or where ResizeObserver is missing). */
function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
