import type { TracksApi } from "./contracts"
import type { HttpClient } from "./http"
import type { ListOf, Track } from "./types"

const track = (id: string) => `/tracks/${encodeURIComponent(id)}`

export function createTracksApi(http: HttpClient): TracksApi {
  return {
    byScene: (sceneId, filter) =>
      http.get<ListOf<Track>>(`/scenes/${encodeURIComponent(sceneId)}/tracks`, {
        query: { ...filter },
      }),
    byMovie: (movieId, filter) =>
      http.get<ListOf<Track>>(`/movies/${encodeURIComponent(movieId)}/tracks`, {
        query: { ...filter },
      }),
    get: (id) => http.get<Track>(track(id)),
    create: (sceneId, body) =>
      http.post<Track>(`/scenes/${encodeURIComponent(sceneId)}/tracks`, {
        body,
      }),
    update: (id, body) => http.put<Track>(track(id), { body }),
    remove: (id) => http.delete(track(id)),
  }
}
