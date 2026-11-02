import { Badge } from "@/components/ui/badge"
import type { Invitation, UserStatus } from "@/lib/api/types"
import { isPastDate } from "@/lib/format/dates"
import { INVITATION_STATUS_LABEL, USER_STATUS_LABEL } from "@/lib/format/labels"
import { cn } from "@/lib/utils"

const USER_TONE: Record<UserStatus, string> = {
  active: "border-license-approved/50 text-license-approved",
  pending: "border-border text-muted-foreground",
  suspended: "border-license-rejected/50 text-license-rejected",
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("bg-transparent", USER_TONE[status])}
    >
      {USER_STATUS_LABEL[status]}
    </Badge>
  )
}

/** The stored status, except that a pending invitation past its date reads as expired. */
export function effectiveInvitationStatus(
  invitation: Pick<Invitation, "status" | "expires_at">
) {
  return invitation.status === "pending" && isPastDate(invitation.expires_at)
    ? "expired"
    : invitation.status
}

const INVITATION_TONE: Record<Invitation["status"], string> = {
  pending: "border-primary/50 text-primary",
  accepted: "border-license-approved/50 text-license-approved",
  revoked: "border-license-rejected/50 text-license-rejected",
  expired: "border-border text-muted-foreground",
}

export function InvitationStatusBadge({
  invitation,
}: {
  invitation: Pick<Invitation, "status" | "expires_at">
}) {
  const status = effectiveInvitationStatus(invitation)
  return (
    <Badge
      variant="outline"
      className={cn("bg-transparent", INVITATION_TONE[status])}
    >
      {INVITATION_STATUS_LABEL[status]}
    </Badge>
  )
}
