import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useLocation, useRouter } from "@tanstack/react-router"
import { useMemo } from "react"

import { AuthFrame } from "@/components/auth/auth-frame"
import { InvitationFlow } from "@/components/auth/invitation-flow"
import { completeSignIn } from "@/lib/auth/sign-in"

export const Route = createFileRoute("/accept-invitation")({
  component: AcceptInvitationPage,
})

/** The token travels in the fragment (`#token=…`) so it never reaches a server log. */
export function tokenFromHash(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, "")).get("token")
  return value && value.length > 0 ? value : null
}

function AcceptInvitationPage() {
  const hash = useLocation({ select: (location) => location.hash })
  const token = useMemo(() => tokenFromHash(hash), [hash])
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <AuthFrame>
      <InvitationFlow
        token={token}
        onSignedIn={async (result) => {
          await completeSignIn(queryClient, result)
          await router.navigate({ to: "/movies", replace: true })
        }}
      />
    </AuthFrame>
  )
}
