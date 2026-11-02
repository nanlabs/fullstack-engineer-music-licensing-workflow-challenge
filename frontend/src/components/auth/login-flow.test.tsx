import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import { membership, token } from "@/test/fixtures"
import { server, url } from "@/test/msw/server"
import { renderWithQuery } from "@/test/render"

import { LoginFlow } from "./login-flow"

const otpError = (
  code: string,
  details: Record<string, unknown>,
  status = 400
) =>
  HttpResponse.json(
    {
      error: {
        code,
        kind: status === 429 ? "RATE_LIMITED" : "VALIDATION",
        message: code,
        details,
      },
    },
    { status }
  )

function arrange(
  initiate = () =>
    HttpResponse.json({
      message: "sent",
      email: "a@acme.test",
      expires_in_seconds: 600,
    })
) {
  server.use(
    http.post(url("/auth/passwordless/tenants"), () =>
      HttpResponse.json({
        email: "a@acme.test",
        tenants: [membership],
        count: 1,
      })
    ),
    http.post(url("/auth/passwordless/login/initiate"), initiate),
    http.post(url("/auth/passwordless/login/verify"), async ({ request }) => {
      const body = (await request.json()) as { code: string }
      return body.code === "123456"
        ? HttpResponse.json(token)
        : otpError("OTP_INVALID", { attempts_remaining: 4 })
    })
  )
}

async function reachCodeStep() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("Email"), "a@acme.test")
  await user.click(screen.getByRole("button", { name: "Continuar" }))
  await screen.findByRole("heading", { name: "Introduce el código" })
  return user
}

describe("LoginFlow", () => {
  it("skips the organisation step when the email has one tenant", async () => {
    arrange()
    renderWithQuery(<LoginFlow onSignedIn={vi.fn()} />)
    await reachCodeStep()
    expect(
      screen.queryByRole("heading", { name: "Elige la organización" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("a@acme.test")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Reenviar código en \d+ s/ })
    ).toBeDisabled()
  })

  it("shows the attempts left after a wrong code and signs in with the right one", async () => {
    arrange()
    const onSignedIn = vi.fn()
    renderWithQuery(<LoginFlow onSignedIn={onSignedIn} />)
    const user = await reachCodeStep()

    await user.keyboard("000000")
    expect(await screen.findByText("4 intentos restantes.")).toBeInTheDocument()

    await user.keyboard("123456")
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(token))
  })

  it("keeps the code step with the server's wait when a code was sent moments ago", async () => {
    arrange(() => otpError("OTP_TOO_MANY_REQUESTS", { retry_after: 42 }, 429))
    renderWithQuery(<LoginFlow onSignedIn={vi.fn()} />)
    await reachCodeStep()
    expect(
      screen.getByText("Espera antes de pedir otro código")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Reenviar código en 4[12] s/ })
    ).toBeDisabled()
  })

  it("tells the user when the email belongs to no organisation", async () => {
    server.use(
      http.post(url("/auth/passwordless/tenants"), () =>
        HttpResponse.json({ email: "x@acme.test", tenants: [], count: 0 })
      )
    )
    renderWithQuery(<LoginFlow onSignedIn={vi.fn()} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Email"), "x@acme.test")
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    expect(
      await screen.findByText(/no pertenece a ninguna organización/)
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Entra con tu email" })
    ).toBeInTheDocument()
  })
})
