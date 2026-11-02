import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  HandshakeIcon,
  HourglassIcon,
  SendIcon,
  type LucideIcon,
} from "lucide-react"

import type { LicenseEventKind, LicenseState } from "@/lib/api/types"
import { LICENSE_STATE_LABEL } from "@/lib/format/labels"

export interface LicenseStateMeta {
  label: string
  Icon: LucideIcon
  /** Tailwind classes bound to the state token. */
  text: string
  bg: string
  border: string
  /** Text colour that reads on top of `bg`. */
  onBg: string
}

export const LICENSE_STATE_META: Record<LicenseState, LicenseStateMeta> = {
  pending: {
    label: LICENSE_STATE_LABEL.pending,
    Icon: CircleDashedIcon,
    text: "text-license-pending",
    bg: "bg-license-pending",
    border: "border-license-pending",
    onBg: "text-background",
  },
  requested: {
    label: LICENSE_STATE_LABEL.requested,
    Icon: SendIcon,
    text: "text-license-requested",
    bg: "bg-license-requested",
    border: "border-license-requested",
    onBg: "text-background",
  },
  negotiating: {
    label: LICENSE_STATE_LABEL.negotiating,
    Icon: HandshakeIcon,
    text: "text-license-negotiating",
    bg: "bg-license-negotiating",
    border: "border-license-negotiating",
    onBg: "text-background",
  },
  approved: {
    label: LICENSE_STATE_LABEL.approved,
    Icon: CircleCheckIcon,
    text: "text-license-approved",
    bg: "bg-license-approved",
    border: "border-license-approved",
    onBg: "text-background",
  },
  rejected: {
    label: LICENSE_STATE_LABEL.rejected,
    Icon: CircleXIcon,
    text: "text-license-rejected",
    bg: "bg-license-rejected",
    border: "border-license-rejected",
    onBg: "text-background",
  },
  expired: {
    label: LICENSE_STATE_LABEL.expired,
    Icon: HourglassIcon,
    text: "text-license-expired",
    bg: "bg-license-expired license-stripes",
    border: "border-license-expired",
    onBg: "text-foreground",
  },
}

/** The event that moves the workflow forward from each state, shown as the primary button. */
export const FORWARD_EVENT: Partial<Record<LicenseState, LicenseEventKind>> = {
  pending: "request",
  requested: "start_negotiation",
  negotiating: "approve",
  rejected: "reopen",
}

/** The backend's default `source` per event; the dialog preselects it. */
export const DEFAULT_SOURCE: Record<
  LicenseEventKind,
  "acme" | "rights_holder"
> = {
  request: "acme",
  reopen: "acme",
  expire: "acme",
  start_negotiation: "rights_holder",
  approve: "rights_holder",
  reject: "rights_holder",
}

/** States during which the cue is frozen and its scene and movie cannot be deleted. */
export function isActiveLicense(state: LicenseState): boolean {
  return (
    state === "requested" || state === "negotiating" || state === "approved"
  )
}
