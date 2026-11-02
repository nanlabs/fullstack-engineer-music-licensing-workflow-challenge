import { describe, expect, it, vi } from "vitest"

import { ApiError, buildUrl, createHttpClient } from "./http"

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

describe("buildUrl", () => {
  it("skips empty query values and encodes the rest", () => {
    expect(
      buildUrl("/api/v1", "/movies", {
        page: 1,
        q: "",
        status: undefined,
        archived: null,
      })
    ).toBe("/api/v1/movies?page=1")
    expect(
      buildUrl("/api/v1", "/songs", { q: "blue room", page_size: 50 })
    ).toBe("/api/v1/songs?q=blue+room&page_size=50")
  })
})

describe("createHttpClient", () => {
  it("sends JSON with the cookie and parses the answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { id: "m1", title: "Static" }))
    const http = createHttpClient({ baseUrl: "/api/v1", fetch: fetchMock })

    const movie = await http.post<{ id: string }>("/movies", {
      body: { title: "Static" },
    })

    expect(movie).toEqual({ id: "m1", title: "Static" })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/movies$/)
    expect(init.method).toBe("POST")
    expect(init.credentials).toBe("include")
    expect(init.body).toBe(JSON.stringify({ title: "Static" }))
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    )
  })

  it("returns undefined for an empty 204", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    const http = createHttpClient({ baseUrl: "/api/v1", fetch: fetchMock })
    await expect(http.delete("/movies/m1")).resolves.toBeUndefined()
  })

  it("turns the error envelope into a typed ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        409,
        {
          error: {
            code: "TRACK_LOCKED_BY_LICENSE",
            kind: "CONFLICT",
            message: "Track is locked",
            details: { state: "approved" },
          },
        },
        { "x-request-id": "req-42" }
      )
    )
    const http = createHttpClient({ baseUrl: "/api/v1", fetch: fetchMock })

    const error = await http
      .put("/tracks/t1", { body: {} })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(409)
    expect(apiError.code).toBe("TRACK_LOCKED_BY_LICENSE")
    expect(apiError.kind).toBe("CONFLICT")
    expect(apiError.detail<string>("state")).toBe("approved")
    expect(apiError.requestId).toBe("req-42")
  })

  it("falls back to the status when the body is not an envelope", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("Bad Gateway", { status: 502 }))
    const http = createHttpClient({ baseUrl: "/api/v1", fetch: fetchMock })
    const error = (await http
      .get("/movies")
      .catch((e: unknown) => e)) as ApiError
    expect(error.code).toBe("HTTP_502")
    expect(error.kind).toBe("EXTERNAL")
  })

  it("reports a network failure as an ApiError with status 0", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"))
    const http = createHttpClient({ baseUrl: "/api/v1", fetch: fetchMock })
    const error = (await http
      .get("/movies")
      .catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(0)
    expect(error.code).toBe("NETWORK_ERROR")
  })

  it("renews the session once on a 401 and retries the request", async () => {
    const unauthorized = () =>
      jsonResponse(401, {
        error: {
          code: "AUTH_SESSION_EXPIRED",
          kind: "UNAUTHORIZED",
          message: "expired",
        },
      })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))
    const renewSession = vi.fn().mockResolvedValue(true)
    const http = createHttpClient({
      baseUrl: "/api/v1",
      fetch: fetchMock,
      renewSession,
    })

    await expect(http.get("/movies")).resolves.toEqual({ items: [] })
    expect(renewSession).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("gives up with the 401 when the session cannot be renewed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(401, {
          error: {
            code: "AUTH_SESSION_EXPIRED",
            kind: "UNAUTHORIZED",
            message: "expired",
          },
        })
      )
    const renewSession = vi.fn().mockResolvedValue(false)
    const http = createHttpClient({
      baseUrl: "/api/v1",
      fetch: fetchMock,
      renewSession,
    })

    const error = (await http
      .get("/movies")
      .catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(401)
    expect(renewSession).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not renew when the request opts out", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(401, {
          error: { code: "AUTH_FAILED", kind: "UNAUTHORIZED", message: "no" },
        })
      )
    const renewSession = vi.fn().mockResolvedValue(true)
    const http = createHttpClient({
      baseUrl: "/api/v1",
      fetch: fetchMock,
      renewSession,
    })

    await expect(
      http.post("/auth/refresh", { renewSession: false })
    ).rejects.toBeInstanceOf(ApiError)
    expect(renewSession).not.toHaveBeenCalled()
  })
})
