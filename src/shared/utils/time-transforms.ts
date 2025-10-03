import { APPLICATION_ERRORS } from '@/src/app/common/response-normalizer/errors'

import { throwError } from './throw-error'

/**
 * Converts a `HH:MM:SS` string into total seconds.
 *
 * @param hhmmss - A string formatted as `HH:MM:SS`.
 * @returns The total number of seconds represented by the string.
 * @throws Will throw an error if the format is invalid.
 *
 * @example
 * hhmmssToSeconds("01:05:07") // 3907
 */
export function hhmmssToSeconds(hhmmss: string): number {
  const [h, m, s] = hhmmss.split(':').map(Number)

  if (
    [h, m, s].some(n => Number.isNaN(n) || n < 0 || n === undefined) ||
    m > 59 ||
    s > 59
  ) {
    throwError(APPLICATION_ERRORS.TRACKS.WRONG_TIME_FORMAT)
  }

  return h * 3600 + m * 60 + s
}

/**
 * Converts a total number of seconds into a `HH:MM:SS` string.
 *
 * @param totalSeconds - The total number of seconds to convert.
 * @returns A string formatted as `HH:MM:SS`.
 *
 * @example
 * secondsToHHMMSS(3907) // "01:05:07"
 */
export function secondsToHHMMSS(totalSeconds: number): string {
  if (totalSeconds < 0) {
    throwError(APPLICATION_ERRORS.TRACKS.WRONG_TIME_FORMAT)
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  return `${hh}:${mm}:${ss}`
}
