import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api } from "@/lib/api"
import type {
  CreateTrack,
  Id,
  Track,
  TrackFilter,
  UpdateTrack,
} from "@/lib/api/types"

export const trackKeys = {
  all: ["tracks"] as const,
  byScene: (sceneId: Id, filter: TrackFilter = {}) =>
    [...trackKeys.all, "scene", sceneId, filter] as const,
  byMovie: (movieId: Id, filter: TrackFilter = {}) =>
    [...trackKeys.all, "movie", movieId, filter] as const,
  detail: (id: Id) => [...trackKeys.all, "detail", id] as const,
}

export const trackQueries = {
  byScene: (sceneId: Id, filter: TrackFilter = {}) =>
    queryOptions({
      queryKey: trackKeys.byScene(sceneId, filter),
      queryFn: () => api.tracks.byScene(sceneId, filter),
    }),
  byMovie: (movieId: Id, filter: TrackFilter = {}) =>
    queryOptions({
      queryKey: trackKeys.byMovie(movieId, filter),
      queryFn: () => api.tracks.byMovie(movieId, filter),
    }),
  detail: (id: Id) =>
    queryOptions({
      queryKey: trackKeys.detail(id),
      queryFn: () => api.tracks.get(id),
    }),
}

/** Every list that can contain the track, by scene and by movie, any filter. */
function invalidateListsOf(
  queryClient: ReturnType<typeof useQueryClient>,
  track: Pick<Track, "scene_id" | "movie_id">
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: [...trackKeys.all, "scene", track.scene_id],
    }),
    queryClient.invalidateQueries({
      queryKey: [...trackKeys.all, "movie", track.movie_id],
    }),
  ])
}

export function useCreateTrack(sceneId: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateTrack) => api.tracks.create(sceneId, body),
    onSuccess: (track) => {
      queryClient.setQueryData(trackKeys.detail(track.id), track)
      return invalidateListsOf(queryClient, track)
    },
  })
}

export function useUpdateTrack(
  track: Pick<Track, "id" | "scene_id" | "movie_id">
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateTrack) => api.tracks.update(track.id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(trackKeys.detail(track.id), updated)
      return invalidateListsOf(queryClient, track)
    },
  })
}

export function useDeleteTrack(
  track: Pick<Track, "id" | "scene_id" | "movie_id">
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.tracks.remove(track.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: trackKeys.detail(track.id) })
      return invalidateListsOf(queryClient, track)
    },
  })
}
