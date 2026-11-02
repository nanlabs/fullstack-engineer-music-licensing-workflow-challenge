import { describe, expect, it } from "vitest"

import { formatDuration, formatTimecode, parseTimecode } from "./timecode"

describe("formatTimecode", () => {
  it("shows minutes and seconds, adding millis only when needed", () => {
    expect(formatTimecode(0)).toBe("00:00")
    expect(formatTimecode(95_000)).toBe("01:35")
    expect(formatTimecode(430_500)).toBe("07:10.500")
    expect(formatTimecode(430_000, { millis: true })).toBe("07:10.000")
  })

  it("adds hours past sixty minutes", () => {
    expect(formatTimecode(5_400_000)).toBe("1:30:00")
    expect(formatTimecode(5_580_000)).toBe("1:33:00")
  })

  it("never shows negative or non-finite values", () => {
    expect(formatTimecode(-5)).toBe("00:00")
    expect(formatTimecode(Number.NaN)).toBe("–")
  })
})

describe("parseTimecode", () => {
  it("round-trips what formatTimecode writes", () => {
    for (const ms of [0, 15_000, 95_000, 430_500, 5_400_000, 5_580_250]) {
      expect(parseTimecode(formatTimecode(ms, { millis: true }))).toBe(ms)
      expect(parseTimecode(formatTimecode(ms))).toBe(ms)
    }
  })

  it("accepts bare seconds, comma fractions and short fractions", () => {
    expect(parseTimecode("45")).toBe(45_000)
    expect(parseTimecode("1:05,5")).toBe(65_500)
    expect(parseTimecode("0:07.25")).toBe(7_250)
    expect(parseTimecode(" 02:00 ")).toBe(120_000)
  })

  it("rejects text that is not a timecode", () => {
    expect(parseTimecode("")).toBeNull()
    expect(parseTimecode("abc")).toBeNull()
    expect(parseTimecode("1:75")).toBeNull()
    expect(parseTimecode("1:60:00")).toBeNull()
    expect(parseTimecode("12:34:56:78")).toBeNull()
  })
})

describe("formatDuration", () => {
  it("reads as minutes and seconds", () => {
    expect(formatDuration(45_000)).toBe("45 s")
    expect(formatDuration(120_000)).toBe("2 min")
    expect(formatDuration(80_000)).toBe("1 min 20 s")
  })
})
