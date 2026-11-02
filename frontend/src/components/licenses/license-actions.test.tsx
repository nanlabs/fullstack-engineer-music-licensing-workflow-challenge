import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { track } from "@/test/fixtures"

import { LicenseActions } from "./license-actions"

describe("LicenseActions", () => {
  it("offers exactly what the state machine allows, forward move first", async () => {
    const onPick = vi.fn()
    render(
      <LicenseActions
        track={track({ state: "requested" })}
        canWrite
        onPick={onPick}
      />
    )
    const buttons = screen.getAllByRole("button")
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Iniciar negociación",
      "Rechazar",
    ])
    await userEvent.click(buttons[1])
    expect(onPick).toHaveBeenCalledWith("reject")
  })

  it("shows nothing for an expired license or without the write scope", () => {
    const { container, rerender } = render(
      <LicenseActions
        track={track({ state: "expired" })}
        canWrite
        onPick={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
    rerender(
      <LicenseActions
        track={track({ state: "pending" })}
        canWrite={false}
        onPick={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("lets a rejected license be reopened and an approved one expire", () => {
    render(
      <LicenseActions
        track={track({ state: "rejected" })}
        canWrite
        onPick={vi.fn()}
      />
    )
    expect(screen.getByRole("button", { name: "Reabrir" })).toBeInTheDocument()
    render(
      <LicenseActions
        track={track({ state: "approved" })}
        canWrite
        onPick={vi.fn()}
      />
    )
    expect(
      screen.getByRole("button", { name: "Marcar como expirada" })
    ).toBeInTheDocument()
  })
})
