import type { LicensesApi } from "./contracts"
import type { HttpClient } from "./http"
import type { LicenseEvent, ListOf, Track } from "./types"

const license = (trackId: string, rest: string) =>
  `/tracks/${encodeURIComponent(trackId)}/license${rest}`

export function createLicensesApi(http: HttpClient): LicensesApi {
  return {
    transition: (trackId, event, body = {}) =>
      http.post<Track>(license(trackId, `/${event}`), { body }),
    history: (trackId) =>
      http.get<ListOf<LicenseEvent>>(license(trackId, "/events")),
  }
}
