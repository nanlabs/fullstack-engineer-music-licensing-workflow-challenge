import { setupServer } from "msw/node"

/** Shared msw server; tests add handlers with `server.use(...)`. */
export const server = setupServer()

/** Absolute matcher for a backend path: Node's fetch resolves `/api/...` against jsdom's origin. */
export const url = (path: string) => `*/api/v1${path}`
