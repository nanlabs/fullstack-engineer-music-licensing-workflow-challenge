import { Link } from "@tanstack/react-router"
import { RadioIcon } from "lucide-react"

import { LicenseStateBadge } from "@/components/licenses/license-state-badge"
import { formatDateTime, formatRelative } from "@/lib/format/dates"
import { LICENSE_EVENT_DONE, LICENSE_SOURCE_LABEL } from "@/lib/format/labels"
import { useRealtime } from "@/lib/realtime/realtime-context"

interface LiveFeedProps {
  /** Only changes of this movie; all of them when absent. */
  movieId?: string
  limit?: number
}

/** License changes received live in this tab, newest first. */
export function LiveFeed({ movieId, limit = 8 }: LiveFeedProps) {
  const { recent, status } = useRealtime()
  const items = (
    movieId ? recent.filter((c) => c.track.movie_id === movieId) : recent
  ).slice(0, limit)

  return (
    <section
      aria-label="Actividad en vivo"
      className="rounded-lg border bg-card p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <RadioIcon className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-base font-semibold">Actividad en vivo</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {status === "live"
            ? "Los cambios de licencia aparecerán aquí al momento, también los que hagan otras personas."
            : "Sin conexión en vivo ahora mismo; los datos se refrescan al navegar."}
        </p>
      ) : (
        <ol className="flex flex-col divide-y">
          {items.map((change) => (
            <li
              key={change.position}
              className="flex items-center justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <Link
                  to="/tracks/$trackId"
                  params={{ trackId: change.track.id }}
                  className="block truncate font-medium hover:underline"
                >
                  {change.track.song.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {LICENSE_EVENT_DONE[change.event]} ·{" "}
                  {LICENSE_SOURCE_LABEL[change.source]} ·{" "}
                  <span title={formatDateTime(change.occurred_at)}>
                    {formatRelative(change.occurred_at)}
                  </span>
                </p>
              </div>
              <LicenseStateBadge state={change.to_state} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
