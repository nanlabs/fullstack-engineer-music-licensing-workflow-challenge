import { ApiError } from './error'
import type { ErrorResponse } from '@/types'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function getBaseUrl(): string {
  return BASE_URL
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, unknown>
  auth?: boolean
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(BASE_URL + path, window.location.origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

/** Thin fetch wrapper for the real backend: JSON in/out, bearer auth,
 *  and AppError -> ApiError translation. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined

  if (!res.ok) {
    throw new ApiError(res.status, data as ErrorResponse)
  }

  return data as T
}

export function get<T>(path: string, query?: object) {
  return request<T>(path, { method: 'GET', query: query as Record<string, unknown> | undefined })
}

export function post<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'POST', body })
}

export function put<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'PUT', body })
}

export function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' })
}
