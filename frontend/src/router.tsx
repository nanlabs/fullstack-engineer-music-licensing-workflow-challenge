import { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"

import {
  RouteError,
  RouteNotFound,
  RoutePending,
} from "@/components/layout/route-states"
import { api, session } from "@/lib/api"
import { isApiError } from "@/lib/api/http"
import { routeTree } from "./routeTree.gen"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // 4xx answers are facts about the request, not transient failures.
      retry: (count, error) =>
        count < 2 &&
        !(isApiError(error) && error.status > 0 && error.status < 500),
    },
    mutations: { retry: false },
  },
})

export const router = createRouter({
  routeTree,
  context: { queryClient, api, session },
  defaultPreload: "intent",
  // Loaders defer to Query's own staleTime instead of the router's cache.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultPendingComponent: RoutePending,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: RouteNotFound,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

// When the session cannot be renewed the cache is stale by definition.
session.onLost(() => {
  queryClient.clear()
  const here = window.location.pathname + window.location.search
  void router.navigate({
    to: "/login",
    search: { redirect: here.startsWith("/login") ? undefined : here },
    replace: true,
  })
})
