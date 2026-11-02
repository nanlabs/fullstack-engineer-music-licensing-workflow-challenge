// Timecodes are shown as `MM:SS` (or `H:MM:SS` past an hour), optionally with
// milliseconds as `.mmm`. Every value the backend stores is an integer count of
// milliseconds on the movie timeline, so parsing always yields whole ms.

const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
const MS_PER_HOUR = 60 * MS_PER_MINUTE

export interface TimecodeOptions {
  /** Append `.mmm`. Default: only when the value is not a whole second. */
  millis?: boolean
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0")
}

export function formatTimecode(
  ms: number,
  options: TimecodeOptions = {}
): string {
  if (!Number.isFinite(ms)) return "–"
  const total = Math.max(0, Math.round(ms))
  const hours = Math.floor(total / MS_PER_HOUR)
  const minutes = Math.floor((total % MS_PER_HOUR) / MS_PER_MINUTE)
  const seconds = Math.floor((total % MS_PER_MINUTE) / MS_PER_SECOND)
  const millis = total % MS_PER_SECOND
  const showMillis = options.millis ?? millis !== 0
  const base =
    hours > 0
      ? `${hours}:${pad(minutes, 2)}:${pad(seconds, 2)}`
      : `${pad(minutes, 2)}:${pad(seconds, 2)}`
  return showMillis ? `${base}.${pad(millis, 3)}` : base
}

/** A span length for reading, e.g. "1 min 20 s" or "45 s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "–"
  const totalSeconds = Math.round(ms / MS_PER_SECOND)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds} s`
  if (seconds === 0) return `${minutes} min`
  return `${minutes} min ${seconds} s`
}

const TIMECODE = /^\s*(?:(\d+):)?(?:(\d{1,2}):)?(\d{1,2})(?:[.,](\d{1,3}))?\s*$/

/**
 * Parses `SS`, `MM:SS`, `H:MM:SS`, each with an optional `.mmm` (or `,mmm`)
 * fraction. Returns whole milliseconds, or `null` when the text is not a
 * timecode or a minutes/seconds field is out of range.
 */
export function parseTimecode(input: string): number | null {
  const match = TIMECODE.exec(input)
  if (!match) return null
  const [, a, b, secondsText, fraction] = match
  // With one separator the regex leaves the leading field in `a`, so `a` is
  // the hours only when `b` (minutes) is also present.
  const hours = a !== undefined && b !== undefined ? Number(a) : 0
  const minutes = b !== undefined ? Number(b) : a !== undefined ? Number(a) : 0
  const seconds = Number(secondsText)
  if (seconds > 59) return null
  if (b !== undefined && minutes > 59) return null
  const millis = fraction ? Number(fraction.padEnd(3, "0")) : 0
  return (
    hours * MS_PER_HOUR +
    minutes * MS_PER_MINUTE +
    seconds * MS_PER_SECOND +
    millis
  )
}
