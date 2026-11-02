import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import { lazy, Suspense } from "react"

import type { Api } from "@/lib/api/contracts"
import type { SessionManager } from "@/lib/auth/session"

export interface RouterContext {
  queryClient: QueryClient
  api: Api
  session: SessionManager
}

const Devtools = import.meta.env.DEV
  ? lazy(() => import("@/components/layout/devtools"))
  : null

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <Outlet />
      {Devtools ? (
        <Suspense fallback={null}>
          <Devtools />
        </Suspense>
      ) : null}
    </>
  )
}
