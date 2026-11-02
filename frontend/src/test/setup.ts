import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll } from "vitest"

import { server } from "./msw/server"

// input-otp positions its caret with this; jsdom does not implement it.
if (
  typeof document !== "undefined" &&
  typeof document.elementFromPoint !== "function"
) {
  document.elementFromPoint = () => null
}

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
