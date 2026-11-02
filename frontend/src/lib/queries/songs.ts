import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { CreateSong, Id, SongFilter, UpdateSong } from "@/lib/api/types"

import { trackKeys } from "./tracks"

export const songKeys = {
  all: ["songs"] as const,
  lists: () => [...songKeys.all, "list"] as const,
  list: (filter: SongFilter) => [...songKeys.lists(), filter] as const,
  detail: (id: Id) => [...songKeys.all, "detail", id] as const,
}

export const songQueries = {
  list: (filter: SongFilter = {}) =>
    queryOptions({
      queryKey: songKeys.list(filter),
      queryFn: () => api.songs.list(filter),
    }),
  detail: (id: Id) =>
    queryOptions({
      queryKey: songKeys.detail(id),
      queryFn: () => api.songs.get(id),
    }),
}

export function useCreateSong() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSong) => api.songs.create(body),
    onSuccess: (song) =>
      queryClient.setQueryData(songKeys.detail(song.id), song),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: songKeys.lists() }),
  })
}

export function useUpdateSong(id: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateSong) => api.songs.update(id, body),
    onSuccess: (song) => queryClient.setQueryData(songKeys.detail(id), song),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: songKeys.lists() }),
        // Tracks embed a song summary (title, artist, rights holder).
        queryClient.invalidateQueries({ queryKey: trackKeys.all }),
      ]),
  })
}

export function useDeleteSong() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: Id) => api.songs.remove(id),
    onSuccess: (_, id) =>
      queryClient.removeQueries({ queryKey: songKeys.detail(id) }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: songKeys.lists() }),
  })
}
