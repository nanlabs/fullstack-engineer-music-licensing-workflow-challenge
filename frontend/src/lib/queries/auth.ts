import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { api, session } from "@/lib/api"
import type { Me, TokenResponse } from "@/lib/api/types"

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
  sessions: () => [...authKeys.all, "sessions"] as const,
}

export const authQueries = {
  me: () =>
    queryOptions({
      queryKey: authKeys.me(),
      queryFn: () => api.auth.me(),
      staleTime: 5 * 60_000,
      // The app layout decides what a 401 means; do not retry it.
      retry: false,
    }),
  sessions: () =>
    queryOptions({
      queryKey: authKeys.sessions(),
      queryFn: () => api.auth.sessions(),
    }),
}

/** The signed-in user; only valid under the app layout, which loads it. */
export function useMe(): Me {
  const { data } = useQuery(authQueries.me())
  if (!data) throw new Error("useMe() outside the authenticated layout")
  return data
}

/** Seeds the `me` query from a login answer so the app opens without a round trip. */
export function meFromToken(token: TokenResponse): Me {
  return {
    user: token.user,
    tenant: token.tenant,
    effective_scopes: token.user.scopes,
    session_id: null,
  }
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      session.cancelScheduledRefresh()
      queryClient.clear()
    },
  })
}
