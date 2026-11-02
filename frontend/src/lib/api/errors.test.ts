import { describe, expect, it } from "vitest"

import { describeError, fieldErrors } from "./errors"
import { ApiError } from "./http"

describe("describeError", () => {
  it("explains a frozen cue with its license state", () => {
    const text = describeError(
      new ApiError(409, "TRACK_LOCKED_BY_LICENSE", "CONFLICT", "locked", {
        state: "approved",
      })
    )
    expect(text.title).toBe("El cue está congelado por su licencia")
    expect(text.description).toContain("aprobada")
  })

  it("lists what the license allows after an invalid transition", () => {
    const text = describeError(
      new ApiError(
        422,
        "LICENSE_INVALID_TRANSITION",
        "BUSINESS",
        "Cannot approve a license that is requested",
        {
          state: "requested",
          event: "approve",
          allowed_events: ["start_negotiation", "reject"],
        }
      )
    )
    expect(text.description).toBe(
      "Está solicitada; ahora puedes: iniciar negociación, rechazar."
    )
  })

  it("counts the attempts left on a wrong code", () => {
    expect(
      describeError(
        new ApiError(400, "OTP_INVALID", "VALIDATION", "bad", {
          attempts_remaining: 1,
        })
      ).description
    ).toBe("1 intento restante.")
    expect(
      describeError(
        new ApiError(400, "OTP_INVALID", "VALIDATION", "bad", {
          attempts_remaining: 0,
        })
      ).description
    ).toBe("No quedan intentos. Pide un código nuevo.")
  })

  it("falls back to the backend message for unknown codes", () => {
    expect(
      describeError(new ApiError(422, "SOMETHING_NEW", "BUSINESS", "Nope"))
    ).toEqual({ title: "Nope" })
    expect(describeError(new Error("boom"))).toEqual({
      title: "Algo salió mal",
      description: "boom",
    })
  })
})

describe("fieldErrors", () => {
  it("reads the validator shape and the single-field shape", () => {
    expect(
      fieldErrors(
        new ApiError(
          400,
          "VALIDATION_ERROR",
          "VALIDATION",
          "Validation failed",
          {
            fields: {
              title: [
                {
                  code: "length",
                  message: "Title must be 1..200 chars",
                  params: {},
                },
              ],
            },
          }
        )
      )
    ).toEqual({ title: "Title must be 1..200 chars" })
    expect(
      fieldErrors(
        new ApiError(
          400,
          "VALIDATION_ERROR",
          "VALIDATION",
          "Track must fall inside the scene window",
          {
            field: "start_ms",
          }
        )
      )
    ).toEqual({ start_ms: "Track must fall inside the scene window" })
    expect(fieldErrors(new Error("x"))).toEqual({})
  })
})
