import { describe, expect, it } from "vitest"

import { hasAnyScope, hasScope } from "./scopes"

describe("hasScope", () => {
  it("matches exact grants, the wildcard and the family wildcard", () => {
    expect(hasScope(["movies:read"], "movies:read")).toBe(true)
    expect(hasScope(["*"], "roles:assign")).toBe(true)
    expect(hasScope(["movies:*"], "movies:write")).toBe(true)
  })

  it("does not let a family wildcard leak into another family", () => {
    expect(hasScope(["movies:*"], "licenses:write")).toBe(false)
    expect(hasScope(["movies:read"], "movies:write")).toBe(false)
    expect(hasScope([], "movies:read")).toBe(false)
  })

  it("hasAnyScope opens a section when one of its scopes is granted", () => {
    expect(
      hasAnyScope(
        ["invitations:read"],
        ["users:read", "invitations:read", "roles:read"]
      )
    ).toBe(true)
    expect(
      hasAnyScope(
        ["movies:*", "licenses:*"],
        ["users:read", "invitations:read", "roles:read"]
      )
    ).toBe(false)
  })
})
