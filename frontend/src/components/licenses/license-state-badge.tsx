import type { LicenseState } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { LICENSE_STATE_META } from "./license-state"

interface LicenseStateBadgeProps {
  state: LicenseState
  size?: "sm" | "md" | "lg"
  className?: string
}

/** Icon + label, tinted by state. Colour is never the only carrier. */
export function LicenseStateBadge({
  state,
  size = "sm",
  className,
}: LicenseStateBadgeProps) {
  const meta = LICENSE_STATE_META[state]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        size === "lg" && "text-xl font-semibold",
        meta.text,
        className
      )}
    >
      <meta.Icon
        className={cn(
          "shrink-0",
          size === "sm" && "size-3.5",
          size === "md" && "size-4",
          size === "lg" && "size-6"
        )}
        aria-hidden
      />
      <span className={size === "lg" ? undefined : "text-foreground"}>
        {meta.label}
      </span>
    </span>
  )
}

/** A small dot, for dense places (scene rows). Pair it with a label or a title. */
export function LicenseStateDot({
  state,
  className,
}: {
  state: LicenseState
  className?: string
}) {
  const meta = LICENSE_STATE_META[state]
  return (
    <span
      className={cn("inline-block size-2 rounded-full", meta.bg, className)}
      title={meta.label}
    />
  )
}
