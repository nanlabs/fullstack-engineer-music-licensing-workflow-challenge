import { useSuspenseQuery } from "@tanstack/react-query"

import { LICENSE_STATE_META } from "@/components/licenses/license-state"
import { formatDateTime, formatRelative } from "@/lib/format/dates"
import {
  LICENSE_EVENT_DONE,
  LICENSE_SOURCE_LABEL,
  LICENSE_STATE_LABEL,
} from "@/lib/format/labels"
import { licenseQueries } from "@/lib/queries/licenses"
import { cn } from "@/lib/utils"

/** Every transition of the license, newest first, as a vertical line. */
export function LicenseHistory({ trackId }: { trackId: string }) {
  const { data } = useSuspenseQuery(licenseQueries.history(trackId))
  const events = [...data.items].reverse()

  return (
    <section
      aria-label="Historial de la licencia"
      className="rounded-lg border bg-card p-4"
    >
      <h2 className="mb-4 text-base font-semibold">Historial</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin movimientos todavía. La licencia nace pendiente con el cue.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-5 before:absolute before:top-2 before:bottom-2 before:left-[9px] before:w-px before:bg-border">
          {events.map((event) => {
            const meta = LICENSE_STATE_META[event.to_state]
            return (
              <li key={event.id} className="relative flex gap-3 pl-7">
                <span
                  className={cn(
                    "absolute top-0.5 left-0 flex size-5 items-center justify-center rounded-full bg-card ring-1 ring-border",
                    meta.text
                  )}
                >
                  <meta.Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {LICENSE_EVENT_DONE[event.event]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {LICENSE_STATE_LABEL[event.from_state]} →{" "}
                    {LICENSE_STATE_LABEL[event.to_state]} ·{" "}
                    {LICENSE_SOURCE_LABEL[event.source]}
                    {event.actor?.name ? ` · ${event.actor.name}` : ""}
                  </p>
                  {event.note ? (
                    <p className="mt-1.5 border-l-2 pl-2.5 text-muted-foreground">
                      {event.note}
                    </p>
                  ) : null}
                  <p
                    className="mt-1 text-xs text-muted-foreground/80"
                    title={formatDateTime(event.created_at)}
                  >
                    {formatRelative(event.created_at)} ·{" "}
                    {formatDateTime(event.created_at)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
