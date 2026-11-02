import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { AppShell } from "@/components/layout/app-shell"
import { RealtimeProvider } from "@/lib/realtime/realtime-provider"
import { isApiError } from "@/lib/api/http"
import { authQueries } from "@/lib/queries/auth"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    try {
      // Goes through the client, which renews the session on a 401 first.
      const me = await context.queryClient.ensureQueryData(authQueries.me())
      return { me }
    } catch (error) {
      if (isApiError(error) && (error.status === 401 || error.status === 403)) {
        throw redirect({
          to: "/login",
          search: { redirect: location.href },
          replace: true,
        })
      }
      throw error
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <RealtimeProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </RealtimeProvider>
  )
}
