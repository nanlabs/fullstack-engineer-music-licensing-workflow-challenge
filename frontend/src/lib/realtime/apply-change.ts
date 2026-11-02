// Folds a `license.changed` event into the Query cache: the track detail
// and every cached list that holds the track are replaced in place; lists
// that should hold it but do not (a cue created elsewhere, a filter the new
// state now matches) are invalidated; the history is always invalidated.

import type { QueryClient } from "@tanstack/react-query"

import type {
  LicenseChanged,
  LicenseState,
  ListOf,
  Track,
} from "@/lib/api/types"
import { licenseKeys } from "@/lib/queries/licenses"
import { trackKeys } from "@/lib/queries/tracks"

type ListKey = readonly [
  ...typeof trackKeys.all,
  "scene" | "movie",
  string,
  { state?: LicenseState }?,
]

function listMatches(
  filter: { state?: LicenseState } | undefined,
  track: Track
): boolean {
  return !filter?.state || filter.state === track.license.state
}

export function applyLicenseChange(
  queryClient: QueryClient,
  change: LicenseChanged
): void {
  const { track } = change
  queryClient.setQueryData<Track>(trackKeys.detail(track.id), track)

  const scopes: ListKey[] = [
    [...trackKeys.all, "scene", track.scene_id],
    [...trackKeys.all, "movie", track.movie_id],
  ]
  for (const scope of scopes) {
    for (const [key, data] of queryClient.getQueriesData<ListOf<Track>>({
      queryKey: scope,
    })) {
      const filter = key[3] as { state?: LicenseState } | undefined
      const shouldHold = listMatches(filter, track)
      const index = data?.items.findIndex((t) => t.id === track.id) ?? -1
      if (!data || (index === -1 && shouldHold)) {
        void queryClient.invalidateQueries({ queryKey: key, exact: true })
        continue
      }
      if (index === -1) continue
      const items = shouldHold
        ? data.items.map((t) => (t.id === track.id ? track : t))
        : data.items.filter((t) => t.id !== track.id)
      queryClient.setQueryData<ListOf<Track>>(key, {
        items,
        count: items.length,
      })
    }
  }

  void queryClient.invalidateQueries({
    queryKey: licenseKeys.history(track.id),
  })
}

/** The server could not replay what we missed: refetch everything license-related. */
export function applyResync(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: trackKeys.all })
  void queryClient.invalidateQueries({ queryKey: licenseKeys.all })
}
