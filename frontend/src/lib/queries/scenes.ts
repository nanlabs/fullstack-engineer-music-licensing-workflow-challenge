import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { CreateScene, Id, Scene, UpdateScene } from "@/lib/api/types"

import { trackKeys } from "./tracks"

export const sceneKeys = {
  all: ["scenes"] as const,
  byMovie: (movieId: Id) => [...sceneKeys.all, "movie", movieId] as const,
  detail: (id: Id) => [...sceneKeys.all, "detail", id] as const,
}

export const sceneQueries = {
  byMovie: (movieId: Id) =>
    queryOptions({
      queryKey: sceneKeys.byMovie(movieId),
      queryFn: () => api.scenes.byMovie(movieId),
    }),
  detail: (id: Id) =>
    queryOptions({
      queryKey: sceneKeys.detail(id),
      queryFn: () => api.scenes.get(id),
    }),
}

export function useCreateScene(movieId: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateScene) => api.scenes.create(movieId, body),
    onSuccess: (scene) =>
      queryClient.setQueryData(sceneKeys.detail(scene.id), scene),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: sceneKeys.byMovie(movieId) }),
  })
}

export function useUpdateScene(scene: Pick<Scene, "id" | "movie_id">) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateScene) => api.scenes.update(scene.id, body),
    onSuccess: (updated) =>
      queryClient.setQueryData(sceneKeys.detail(scene.id), updated),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: sceneKeys.byMovie(scene.movie_id),
      }),
  })
}

export function useDeleteScene(movieId: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: Id) => api.scenes.remove(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: sceneKeys.detail(id) })
      queryClient.removeQueries({ queryKey: trackKeys.byScene(id) })
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: sceneKeys.byMovie(movieId) }),
        queryClient.invalidateQueries({ queryKey: trackKeys.byMovie(movieId) }),
      ]),
  })
}

export function useReorderScenes(movieId: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sceneIds: Id[]) => api.scenes.reorder(movieId, sceneIds),
    onSuccess: (list) =>
      queryClient.setQueryData(sceneKeys.byMovie(movieId), list),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: sceneKeys.byMovie(movieId) }),
        // Movie-wide track lists are ordered by scene position.
        queryClient.invalidateQueries({ queryKey: trackKeys.byMovie(movieId) }),
      ]),
  })
}
