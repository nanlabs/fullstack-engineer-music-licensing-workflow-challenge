import { Link } from "@tanstack/react-router"

import { LICENSE_STATE_META } from "@/components/licenses/license-state"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Track } from "@/lib/api/types"
import { formatTimecode } from "@/lib/format/timecode"
import { placeInWindow, type TimeWindow } from "@/lib/format/timeline"
import { cn } from "@/lib/utils"

export const LANE_HEIGHT = 24

interface CueBarProps {
  track: Track
  window: TimeWindow
  lane: number
  /** Allow the song title inside the bar; it still hides when the bar is too narrow. */
  label?: boolean
}

/** A cue on a timeline strip: position from its in/out, colour from its license state. */
export function CueBar({ track, window, lane, label = true }: CueBarProps) {
  const meta = LICENSE_STATE_META[track.license.state]
  const { left, width } = placeInWindow(track, window)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/tracks/$trackId"
          params={{ trackId: track.id }}
          aria-label={`${track.song.title}, ${meta.label}, de ${formatTimecode(track.start_ms)} a ${formatTimecode(track.end_ms)}`}
          className={cn(
            "@container absolute flex h-5 items-center overflow-hidden rounded-[3px] px-1.5 text-[11px] leading-none font-medium transition-[background-color,transform] duration-300 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:hover:-translate-y-px",
            meta.bg,
            meta.onBg
          )}
          style={{
            left: `${left}%`,
            width: `${width}%`,
            top: lane * LANE_HEIGHT + 4,
          }}
        >
          {label ? (
            <span className="hidden truncate @min-[3.5rem]:inline">
              {track.song.title}
            </span>
          ) : null}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">
          {track.song.title}{" "}
          <span className="font-normal opacity-80">· {track.song.artist}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <meta.Icon className="size-3" aria-hidden /> {meta.label}
          <span className="timecode opacity-80">
            {formatTimecode(track.start_ms)} – {formatTimecode(track.end_ms)}
          </span>
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
