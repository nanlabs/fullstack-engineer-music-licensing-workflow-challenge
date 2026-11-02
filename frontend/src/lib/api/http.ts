import type { ApiErrorBody, ErrorKind } from "./types"

/** A failed request, carrying the backend's error envelope. */
export class ApiError extends Error {
  override readonly name = "ApiError"
  readonly status: number
  readonly code: string
  readonly kind: ErrorKind
  readonly details: Record<string, unknown>
  /** The backend's `x-request-id`, for the technical detail of an error. */
  readonly requestId: string | null

  constructor(
    status: number,
    code: string,
    kind: ErrorKind,
    message: string,
    details: Record<string, unknown> = {},
    requestId: string | null = null
  ) {
    super(message)
    this.status = status
    this.code = code
    this.kind = kind
    this.details = details
    this.requestId = requestId
  }

  detail<T = unknown>(key: string): T | undefined {
    return this.details[key] as T | undefined
  }
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return (
    error instanceof ApiError && (code === undefined || error.code === code)
  )
}

export type Query = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  query?: Query
  body?: unknown
  signal?: AbortSignal
  /**
   * When false, a 401 is returned as-is instead of trying to renew the
   * session first. Auth endpoints set it so a failed login never loops.
   */
  renewSession?: boolean
}

export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>
  post<T>(path: string, options?: RequestOptions): Promise<T>
  put<T>(path: string, options?: RequestOptions): Promise<T>
  delete<T = void>(path: string, options?: RequestOptions): Promise<T>
}

export interface HttpClientOptions {
  /** Prefix of every path, e.g. `/api/v1`. */
  baseUrl: string
  fetch?: typeof fetch
  /**
   * Called on a 401. Resolves `true` when the session was renewed and the
   * request should be retried once; `false` ends the attempt with the 401.
   */
  renewSession?: () => Promise<boolean>
}

const KIND_BY_STATUS: Record<number, ErrorKind> = {
  400: "VALIDATION",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "BUSINESS",
  429: "RATE_LIMITED",
  502: "EXTERNAL",
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value))
    return false
  const error = (value as { error: unknown }).error
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  )
}

export function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const url = baseUrl + path
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init))

  async function request<T>(
    method: string,
    path: string,
    opts: RequestOptions = {}
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" }
    if (opts.body !== undefined) headers["Content-Type"] = "application/json"

    let response: Response
    try {
      response = await fetchImpl(
        absolute(buildUrl(options.baseUrl, path, opts.query)),
        {
          method,
          headers,
          credentials: "include",
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: opts.signal,
        }
      )
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError")
        throw cause
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        "EXTERNAL",
        "Network request failed"
      )
    }

    if (
      response.status === 401 &&
      opts.renewSession !== false &&
      options.renewSession
    ) {
      const renewed = await options.renewSession()
      if (renewed)
        return request<T>(method, path, { ...opts, renewSession: false })
    }

    const text = await response.text()
    const json: unknown = text ? safeParse(text) : undefined

    if (!response.ok) {
      const requestId = response.headers.get("x-request-id")
      if (isErrorBody(json)) {
        const { code, kind, message, details } = json.error
        throw new ApiError(
          response.status,
          code,
          kind,
          message,
          details ?? {},
          requestId
        )
      }
      throw new ApiError(
        response.status,
        `HTTP_${response.status}`,
        KIND_BY_STATUS[response.status] ?? "INTERNAL",
        response.statusText || `Request failed with status ${response.status}`,
        {},
        requestId
      )
    }

    return json as T
  }

  return {
    get: (path, opts) => request("GET", path, opts),
    post: (path, opts) => request("POST", path, opts),
    put: (path, opts) => request("PUT", path, opts),
    delete: (path, opts) => request("DELETE", path, opts),
  }
}

/** Browsers resolve `/api/...` themselves; Node's fetch (tests) needs the origin. */
function absolute(url: string): string {
  return url.startsWith("/") && typeof location !== "undefined"
    ? `${location.origin}${url}`
    : url
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
