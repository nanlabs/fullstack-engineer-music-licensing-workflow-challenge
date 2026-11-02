import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api } from "@/lib/api"
import type {
  CreateMovie,
  Id,
  Movie,
  MovieFilter,
  UpdateMovie,
} from "@/lib/api/types"

export const movieKeys = {
  all: ["movies"] as const,
  lists: () => [...movieKeys.all, "list"] as const,
  list: (filter: MovieFilter) => [...movieKeys.lists(), filter] as const,
  detail: (id: Id) => [...movieKeys.all, "detail", id] as const,
}

export const movieQueries = {
  list: (filter: MovieFilter = {}) =>
    queryOptions({
      queryKey: movieKeys.list(filter),
      queryFn: () => api.movies.list(filter),
    }),
  detail: (id: Id) =>
    queryOptions({
      queryKey: movieKeys.detail(id),
      queryFn: () => api.movies.get(id),
    }),
}

export function useCreateMovie() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateMovie) => api.movies.create(body),
    onSuccess: (movie) =>
      queryClient.setQueryData(movieKeys.detail(movie.id), movie),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: movieKeys.lists() }),
  })
}

export function useUpdateMovie(id: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateMovie) => api.movies.update(id, body),
    onSuccess: (movie: Movie) =>
      queryClient.setQueryData(movieKeys.detail(id), movie),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: movieKeys.lists() }),
  })
}

export function useDeleteMovie() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: Id) => api.movies.remove(id),
    onSuccess: (_, id) =>
      queryClient.removeQueries({ queryKey: movieKeys.detail(id) }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: movieKeys.lists() }),
  })
}
