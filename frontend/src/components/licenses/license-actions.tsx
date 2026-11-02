import { Button } from "@/components/ui/button"
import type { LicenseEventKind, Track } from "@/lib/api/types"
import { LICENSE_EVENT_ACTION } from "@/lib/format/labels"

import { FORWARD_EVENT } from "./license-state"

interface LicenseActionsProps {
  track: Pick<Track, "license">
  canWrite: boolean
  onPick: (event: LicenseEventKind) => void
  disabled?: boolean
}

const ORDER: LicenseEventKind[] = [
  "request",
  "start_negotiation",
  "approve",
  "reopen",
  "reject",
  "expire",
]

/** One button per event the state machine allows; the forward move is primary. */
export function LicenseActions({
  track,
  canWrite,
  onPick,
  disabled,
}: LicenseActionsProps) {
  const { state, allowed_events } = track.license
  if (!canWrite) return null
  if (allowed_events.length === 0) return null
  const events = [...allowed_events].sort(
    (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)
  )
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Acciones de la licencia"
    >
      {events.map((event) => {
        const variant =
          event === FORWARD_EVENT[state]
            ? "default"
            : event === "reject"
              ? "destructive"
              : "outline"
        return (
          <Button
            key={event}
            variant={variant}
            disabled={disabled}
            onClick={() => onPick(event)}
          >
            {LICENSE_EVENT_ACTION[event]}
          </Button>
        )
      })}
    </div>
  )
}
