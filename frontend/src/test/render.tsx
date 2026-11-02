import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
}

/** Renders inside a fresh QueryClient; the router is not needed for component tests. */
export function renderWithQuery(
  ui: ReactElement,
  options: RenderOptions & { queryClient?: QueryClient } = {}
) {
  const { queryClient = createTestQueryClient(), ...rest } = options
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, ...render(ui, { wrapper, ...rest }) }
}
