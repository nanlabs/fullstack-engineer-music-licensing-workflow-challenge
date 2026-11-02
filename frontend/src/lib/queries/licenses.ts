import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api } from "@/lib/api"
import type {
  Id,
  LicenseEventKind,
  Track,
  TransitionRequest,
} from "@/lib/api/types"

import { trackKeys } from "./tracks"

export const licenseKeys = {
  all: ["licenses"] as const,
  history: (trackId: Id) => [...licenseKeys.all, "history", trackId] as const,
}

export const licenseQueries = {
  history: (trackId: Id) =>
    queryOptions({
      queryKey: licenseKeys.history(trackId),
      queryFn: () => api.licenses.history(trackId),
    }),
}

export interface TransitionInput {
  event: LicenseEventKind
  body?: TransitionRequest
}

/**
 * Moves the license of one track. The answer replaces the cached track;
 * the lists and the history also arrive through the live stream, but are
 * invalidated here so the acting tab never depends on it.
 */
export function useTransitionLicense(
  track: Pick<Track, "id" | "scene_id" | "movie_id">
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ event, body }: TransitionInput) =>
      api.licenses.transition(track.id, event, body),
    onSuccess: (updated) =>
      queryClient.setQueryData(trackKeys.detail(track.id), updated),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: licenseKeys.history(track.id),
        }),
        queryClient.invalidateQueries({
          queryKey: [...trackKeys.all, "scene", track.scene_id],
        }),
        queryClient.invalidateQueries({
          queryKey: [...trackKeys.all, "movie", track.movie_id],
        }),
      ]),
  })
}
