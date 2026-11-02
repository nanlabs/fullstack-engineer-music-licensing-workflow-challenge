import type { SongsApi } from "./contracts"
import type { HttpClient } from "./http"
import type { Paginated, Song } from "./types"

const path = (id: string) => `/songs/${encodeURIComponent(id)}`

export function createSongsApi(http: HttpClient): SongsApi {
  return {
    list: (filter) =>
      http.get<Paginated<Song>>("/songs", { query: { ...filter } }),
    get: (id) => http.get<Song>(path(id)),
    create: (body) => http.post<Song>("/songs", { body }),
    update: (id, body) => http.put<Song>(path(id), { body }),
    remove: (id) => http.delete(path(id)),
  }
}
