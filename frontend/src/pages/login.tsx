import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { getApiMode } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const DEMO_ACCOUNTS = [
  { email: 'casey@studio.dev', role: 'Producer', desc: 'Movie supervisor (Studio)' },
  { email: 'jordan@studio.dev', role: 'Producer', desc: 'Movie team member (Studio)' },
  { email: 'nova@indie.dev', role: 'Artist', desc: 'Song creator (Rights holder)' },
  { email: 'iris@solo.dev', role: 'Artist', desc: 'Independent artist (no label)' },
  { email: 'priya@wavelabel.dev', role: 'Label Manager', desc: 'Label owner (Wave Records)' },
  { email: 'mateo@wavelabel.dev', role: 'Label Manager', desc: 'Label rep (Wave Records)' },
  { email: 'sam@studio.dev', role: 'Admin', desc: 'Platform administrator' },
]

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const stateFrom = (location.state as { from?: { pathname: string } })?.from?.pathname

  function defaultRoute(scopes: string[]): string {
    if (scopes.includes('*')) return '/studio'
    if (scopes.includes('movies:*')) return '/studio'
    if (scopes.includes('songs:*')) return '/rights'
    return '/studio'
  }

  /** Only honor the pre-login location if the user's scopes allow that section. */
  function resolveDest(scopes: string[]): string {
    if (stateFrom) {
      const canStudio = scopes.includes('*') || scopes.includes('movies:*')
      const canRights = scopes.includes('*') || scopes.includes('songs:*')
      if (stateFrom.startsWith('/studio') && canStudio) return stateFrom
      if (stateFrom.startsWith('/rights') && canRights) return stateFrom
    }
    return defaultRoute(scopes)
  }

  // If already logged in, redirect
  if (user && getApiMode() === 'real') return <Navigate to={resolveDest(user.scopes)} replace />

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const me = await login(email, password)
      navigate(resolveDest(me.scopes), { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  function quickLogin(demoEmail: string) {
    setEmail(demoEmail)
    setPassword('abraxas12345')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            ML
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Music Licensing</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Demo accounts</CardTitle>
            <CardDescription className="text-xs">Click to fill credentials (password: abraxas12345)</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.email}
                type="button"
                onClick={() => quickLogin(acc.email)}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{acc.email}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{acc.desc}</p>
                </div>
                <span className="ml-2 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                  {acc.role}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
