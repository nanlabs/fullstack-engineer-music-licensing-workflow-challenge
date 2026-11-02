import { createContext, useContext } from "react"

import type { LicenseChanged } from "@/lib/api/types"

export type RealtimeStatus = "connecting" | "live" | "reconnecting" | "offline"

export interface RealtimeState {
  status: RealtimeStatus
  /** Most recent license changes first, capped. */
  recent: LicenseChanged[]
}

export const RealtimeContext = createContext<RealtimeState>({
  status: "offline",
  recent: [],
})

export function useRealtime(): RealtimeState {
  return useContext(RealtimeContext)
}
