import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { LicenseStateBadge } from "@/components/licenses/license-state-badge"
import { isApiError } from "@/lib/api/http"
import type { Scene, Track } from "@/lib/api/types"
import { plural } from "@/lib/format/labels"
import { sceneKeys } from "@/lib/queries/scenes"
import { trackKeys } from "@/lib/queries/tracks"

interface LockedCue {
  id: string
  track: Track | null
  scene: Scene | null
}

function isTrack(value: unknown): value is Track {
  return (
    typeof value === "object" &&
    value !== null &&
    "song" in value &&
    "license" in value
  )
}

function isScene(value: unknown): value is Scene {
  return (
    typeof value === "object" &&
    value !== null &&
    "position" in value &&
    "movie_id" in value
  )
}

/** Every entity of a kind the cache holds, whether cached alone or inside a list. */
function cached<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  guard: (v: unknown) => v is T
): T[] {
  const found: T[] = []
  for (const [, data] of queryClient.getQueriesData<unknown>({ queryKey })) {
    if (guard(data)) found.push(data)
    else if (
      typeof data === "object" &&
      data !== null &&
      "items" in data &&
      Array.isArray(data.items)
    ) {
      for (const item of data.items) if (guard(item)) found.push(item)
    }
  }
  return found
}

/**
 * The cues named by a 409 (`track_ids`) as links, so the user can go and
 * release them. Names come from whatever the Query cache already holds
 * (the page that raised the conflict has usually loaded them); an unknown
 * id falls back to its short form.
 */
export function LockedTracksNotice({ error }: { error: unknown }) {
  const queryClient = useQueryClient()
  if (!isApiError(error)) return null
  const ids = error.detail<string[]>("track_ids")
  if (!Array.isArray(ids) || ids.length === 0) return null

  const tracks = cached(queryClient, trackKeys.all, isTrack)
  const scenes = cached(queryClient, sceneKeys.all, isScene)
  const cues: LockedCue[] = ids.map((id) => {
    const track = tracks.find((t) => t.id === id) ?? null
    const scene = track
      ? (scenes.find((s) => s.id === track.scene_id) ?? null)
      : null
    return { id, track, scene }
  })

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm">
      <p className="mb-1.5 text-muted-foreground">
        {plural(ids.length, "cue bloqueado", "cues bloqueados")}:
      </p>
      <ul className="flex flex-col gap-1.5">
        {cues.map(({ id, track, scene }) => (
          <li key={id} className="flex items-center justify-between gap-3">
            <Link
              to="/tracks/$trackId"
              params={{ trackId: id }}
              className="min-w-0 truncate hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {track ? (
                <>
                  <span className="font-medium">{track.song.title}</span>
                  {scene ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {scene.title}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="timecode text-xs text-primary">
                  {id.slice(0, 8)}
                </span>
              )}
            </Link>
            {track ? <LicenseStateBadge state={track.license.state} /> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
