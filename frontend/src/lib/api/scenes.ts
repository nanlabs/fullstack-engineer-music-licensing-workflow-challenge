import type { ScenesApi } from "./contracts"
import type { HttpClient } from "./http"
import type { ListOf, Scene } from "./types"

const scene = (id: string) => `/scenes/${encodeURIComponent(id)}`
const movieScenes = (movieId: string, rest = "") =>
  `/movies/${encodeURIComponent(movieId)}/scenes${rest}`

export function createScenesApi(http: HttpClient): ScenesApi {
  return {
    byMovie: (movieId) => http.get<ListOf<Scene>>(movieScenes(movieId)),
    get: (id) => http.get<Scene>(scene(id)),
    create: (movieId, body) => http.post<Scene>(movieScenes(movieId), { body }),
    update: (id, body) => http.put<Scene>(scene(id), { body }),
    remove: (id) => http.delete(scene(id)),
    reorder: (movieId, sceneIds) =>
      http.put<ListOf<Scene>>(movieScenes(movieId, "/order"), {
        body: { scene_ids: sceneIds },
      }),
  }
}
