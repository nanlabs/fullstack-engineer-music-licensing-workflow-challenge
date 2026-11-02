import type { MoviesApi } from "./contracts"
import type { HttpClient } from "./http"
import type { Movie, Paginated } from "./types"

const path = (id: string, rest = "") =>
  `/movies/${encodeURIComponent(id)}${rest}`

export function createMoviesApi(http: HttpClient): MoviesApi {
  return {
    list: (filter) =>
      http.get<Paginated<Movie>>("/movies", { query: { ...filter } }),
    get: (id) => http.get<Movie>(path(id)),
    create: (body) => http.post<Movie>("/movies", { body }),
    update: (id, body) => http.put<Movie>(path(id), { body }),
    remove: (id) => http.delete(path(id)),
  }
}
