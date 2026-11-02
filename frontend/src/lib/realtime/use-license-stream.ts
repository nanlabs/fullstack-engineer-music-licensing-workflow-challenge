import { useEffect, useRef, useState } from "react"

import { API_BASE, session } from "@/lib/api"
import type { LicenseChanged, ResyncNotice } from "@/lib/api/types"

import type { RealtimeStatus } from "./realtime-context"

export const EVENTS_URL = `${API_BASE}/events`
const MIN_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

interface StreamHandlers {
  onChange: (change: LicenseChanged) => void
  onResync: (notice: ResyncNotice) => void
}

/**
 * One EventSource per tab. The browser reconnects on its own when the
 * server closes the stream (every 15 min, with `Last-Event-ID` so nothing
 * is lost). A non-200 answer (the access cookie expired) closes it for
 * good: then the session is renewed and a new one is opened, and because
 * that one starts at the head, a resync is requested.
 */
export const supportsEventSource = typeof EventSource !== "undefined"

export function useLicenseStream(handlers: StreamHandlers): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>(
    supportsEventSource ? "connecting" : "offline"
  )
  // The handlers change identity with every render; the stream reads the
  // latest through a ref so it is opened once per mount.
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    if (!supportsEventSource) return
    let source: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let backoff = MIN_BACKOFF_MS
    let stopped = false
    let everOpened = false

    const connect = () => {
      source = new EventSource(EVENTS_URL)
      source.onopen = () => {
        backoff = MIN_BACKOFF_MS
        if (everOpened) latest.current.onResync({ reason: "reconnected" })
        everOpened = true
        setStatus("live")
      }
      source.addEventListener("license.changed", (event) => {
        latest.current.onChange(
          JSON.parse((event as MessageEvent<string>).data) as LicenseChanged
        )
      })
      source.addEventListener("resync", (event) => {
        latest.current.onResync(
          JSON.parse((event as MessageEvent<string>).data) as ResyncNotice
        )
      })
      source.onerror = () => {
        if (!source || stopped) return
        if (source.readyState === EventSource.CONNECTING) {
          // The browser is retrying by itself (server-side close or a blip).
          setStatus("reconnecting")
          return
        }
        // CLOSED: the response was not a stream. Renew the session and start again.
        source.close()
        source = null
        setStatus("reconnecting")
        void session.refresh().then((renewed) => {
          if (stopped) return
          if (!renewed) {
            setStatus("offline")
            return
          }
          timer = setTimeout(connect, backoff)
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
        })
      }
    }

    connect()
    return () => {
      stopped = true
      if (timer !== undefined) clearTimeout(timer)
      source?.close()
    }
  }, [])

  return status
}
