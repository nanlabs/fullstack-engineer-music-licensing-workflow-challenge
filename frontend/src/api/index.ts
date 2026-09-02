// Public entry point: `api` proxies every call to either the real HTTP
// client or the in-memory mock, based on the current mode (see mode.ts).
// Consumers just do `api.movies.list(...)` and never worry about which
// backend is active.

import { getApiMode } from './mode'
import { realApi } from './real'
import { mockApi } from './mock/backend'
import type { Api } from './types'

const backends: Record<'mock' | 'real', Api> = {
  mock: mockApi,
  real: realApi,
}

function createProxy<T extends object>(resourceKey: keyof Api): T {
  return new Proxy({} as T, {
    get(_target, method) {
      return (...args: unknown[]) => {
        const backend = backends[getApiMode()][resourceKey] as unknown as Record<string, (...a: unknown[]) => unknown>
        return backend[method as string](...args)
      }
    },
  })
}

export const api: Api = {
  auth: createProxy('auth'),
  movies: createProxy('movies'),
  scenes: createProxy('scenes'),
  songs: createProxy('songs'),
  tracks: createProxy('tracks'),
  labels: createProxy('labels'),
  licenses: createProxy('licenses'),
}

export { getApiMode, type ApiMode } from './mode'
export { ApiError } from './error'
export type * from './types'
