import { useCallback, useSyncExternalStore } from "react"

/**
 * Seconds left until `deadline` (epoch ms), ticking once a second; 0 when
 * there is no deadline or it passed. Time is an external store: the
 * snapshot is the whole second, so renders happen only when it changes.
 */
export function useCountdown(deadline: number | null): number {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (deadline === null) return () => {}
      const id = setInterval(notify, 1000)
      return () => clearInterval(id)
    },
    [deadline]
  )
  const getSnapshot = useCallback(
    () =>
      deadline === null
        ? 0
        : Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
    [deadline]
  )
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
