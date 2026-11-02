import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

import type { LicenseChanged } from "@/lib/api/types"
import { LICENSE_EVENT_DONE, LICENSE_STATE_LABEL } from "@/lib/format/labels"

import { applyLicenseChange, applyResync } from "./apply-change"
import { RealtimeContext } from "./realtime-context"
import { useLicenseStream } from "./use-license-stream"

const RECENT_LIMIT = 50

/** The toast id both the acting tab and the stream use, so the same change never shows twice. */
export function changeToastId(trackId: string, updatedAt: string): string {
  return `license:${trackId}:${updatedAt}`
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [recent, setRecent] = useState<LicenseChanged[]>([])

  const onChange = useCallback(
    (change: LicenseChanged) => {
      applyLicenseChange(queryClient, change)
      setRecent((list) => {
        if (list.some((c) => c.position === change.position)) return list
        return [change, ...list].slice(0, RECENT_LIMIT)
      })
      const { track } = change
      toast(LICENSE_EVENT_DONE[change.event], {
        id: changeToastId(track.id, track.license.updated_at),
        description: `${track.song.title} · ${track.song.artist} → ${LICENSE_STATE_LABEL[change.to_state].toLowerCase()}`,
        action: {
          label: "Ver cue",
          onClick: () =>
            void navigate({
              to: "/tracks/$trackId",
              params: { trackId: track.id },
            }),
        },
      })
    },
    [queryClient, navigate]
  )
  const onResync = useCallback(() => applyResync(queryClient), [queryClient])

  const status = useLicenseStream({ onChange, onResync })
  const value = useMemo(() => ({ status, recent }), [status, recent])

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}
