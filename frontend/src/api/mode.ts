// Global switch between the real backend and the in-memory mock backend.
//
// The mock backend exists purely for local UI development without a running
// server. Which one is active is decided once, at build/boot time, via the
// VITE_USE_MOCK_API env var — it is NOT a runtime user-facing toggle. The
// app always talks to the real backend unless that flag is explicitly set.

export type ApiMode = 'mock' | 'real'

const MODE: ApiMode = import.meta.env.VITE_USE_MOCK_API === 'true' ? 'mock' : 'real'

export function getApiMode(): ApiMode {
  return MODE
}
