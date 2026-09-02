import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, getApiMode } from '@/api'
import { setAccessToken } from '@/api/http'
import { cacheUserName } from '@/lib/user-name'
import type { MeResponse } from '@/types'

// ─── Types ───

interface AuthState {
  user: MeResponse | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<MeResponse>
  logout: () => Promise<void>
}

const REFRESH_KEY = 'refresh_token'

function storedRefresh(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

function storeRefresh(token: string | null) {
  if (token) localStorage.setItem(REFRESH_KEY, token)
  else localStorage.removeItem(REFRESH_KEY)
}

// ─── Context ───

const AuthCtx = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

// ─── Provider ───

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Schedule a silent token refresh slightly before expiry.
  const scheduleRefresh = useCallback((expiresIn: number) => {
    clearTimeout(refreshTimer.current)
    // Refresh 60 s before expiry (or at half-life if < 120 s)
    const ms = Math.max((expiresIn - 60) * 1000, (expiresIn / 2) * 1000)
    refreshTimer.current = setTimeout(async () => {
      const rt = storedRefresh()
      if (!rt) return
      try {
        const tokens = await api.auth.refresh(rt)
        storeRefresh(tokens.refresh_token)
        scheduleRefresh(tokens.expires_in)
      } catch {
        // refresh failed — force logout
        setAccessToken(null)
        storeRefresh(null)
        setState({ user: null, loading: false })
      }
    }, ms)
  }, [])

  // On mount (or mode change): try to restore session from stored refresh token.
  useEffect(() => {
    let cancelled = false
    const rt = storedRefresh()
    const mode = getApiMode()

    if (mode === 'mock') {
      // Mock mode: no real auth, just load mock /me
      setState({ user: null, loading: false })
      return
    }

    if (!rt) {
      setState({ user: null, loading: false })
      return
    }

    ;(async () => {
      try {
        const tokens = await api.auth.refresh(rt)
        storeRefresh(tokens.refresh_token)
        const user = await api.auth.me()
        if (!cancelled) {
          cacheUserName(user.user_id, user.name)
          setState({ user, loading: false })
          scheduleRefresh(tokens.expires_in)
        }
      } catch {
        storeRefresh(null)
        setAccessToken(null)
        if (!cancelled) setState({ user: null, loading: false })
      }
    })()

    return () => {
      cancelled = true
      clearTimeout(refreshTimer.current)
    }
  }, [scheduleRefresh])

  const login = useCallback(async (email: string, password: string): Promise<MeResponse> => {
    const tokens = await api.auth.login({ email, password })
    storeRefresh(tokens.refresh_token)
    const user = await api.auth.me()
    cacheUserName(user.user_id, user.name)
    setState({ user, loading: false })
    scheduleRefresh(tokens.expires_in)
    return user
  }, [scheduleRefresh])

  const logout = useCallback(async () => {
    const rt = storedRefresh()
    try {
      if (rt) await api.auth.logout(rt)
    } catch {
      // ignore — we clear local state regardless
    }
    clearTimeout(refreshTimer.current)
    setAccessToken(null)
    storeRefresh(null)
    setState({ user: null, loading: false })
  }, [])

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
