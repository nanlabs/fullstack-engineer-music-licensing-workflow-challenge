import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { z } from "zod"

import { AuthFrame } from "@/components/auth/auth-frame"
import { LoginFlow } from "@/components/auth/login-flow"
import { completeSignIn, safeRedirect } from "@/lib/auth/sign-in"
import { authQueries } from "@/lib/queries/auth"

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: ({ context, search }) => {
    // Signed in during this visit: skip the form.
    if (context.queryClient.getQueryData(authQueries.me().queryKey)) {
      throw redirect({
        to: safeRedirect(search.redirect) ?? "/movies",
        replace: true,
      })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target } = Route.useSearch()
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <AuthFrame>
      <LoginFlow
        onSignedIn={async (token) => {
          await completeSignIn(queryClient, token)
          const safe = safeRedirect(target)
          if (safe) router.history.replace(safe)
          else await router.navigate({ to: "/movies", replace: true })
        }}
      />
    </AuthFrame>
  )
}
