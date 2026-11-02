import { LockIcon } from "lucide-react"

import { isActiveLicense } from "@/components/licenses/license-state"
import type { LicenseState } from "@/lib/api/types"
import { LICENSE_STATE_LABEL } from "@/lib/format/labels"

/** Why the cue cannot be edited or removed right now. */
export function TrackLockNotice({
  state,
  className,
}: {
  state: LicenseState
  className?: string
}) {
  if (!isActiveLicense(state)) return null
  return (
    <div className={className}>
      <p className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          El cue está congelado: su licencia está{" "}
          {LICENSE_STATE_LABEL[state].toLowerCase()}. Para cambiarlo, recházala
          o márcala como expirada.
        </span>
      </p>
    </div>
  )
}

export function lockReason(state: LicenseState): string | null {
  return isActiveLicense(state)
    ? `Congelado: licencia ${LICENSE_STATE_LABEL[state].toLowerCase()}`
    : null
}
