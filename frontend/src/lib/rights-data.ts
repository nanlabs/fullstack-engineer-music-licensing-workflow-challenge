import { api } from '@/api'
import type { RightsPersona } from '@/lib/rights-persona'
import type { LicenseOffer, LicenseRequest, Movie, Scene, Song, Track } from '@/types'

export interface RightsLicenseItem {
  license: LicenseRequest
  offers: LicenseOffer[]
  latestOffer?: LicenseOffer
  track: Track
  song: Song
  scene?: Scene
  movie?: Movie
}

export interface SongPlacement {
  track: Track
  scene?: Scene
  movie?: Movie
  license: LicenseRequest | null
  offers: LicenseOffer[]
}

export async function loadRightsSongs(persona: RightsPersona): Promise<Song[]> {
  if (persona.catalogScope === 'label' && persona.labelId) {
    return api.labels.listSongs(persona.labelId)
  }

  const artistSongs = await api.songs.listByArtist(persona.user.id)
  if (persona.kind === 'independent') {
    return artistSongs.filter(song => song.label_id === null)
  }
  return artistSongs.filter(song => song.label_id === persona.labelId)
}

export async function loadSongPlacements(song: Song): Promise<SongPlacement[]> {
  const tracks = await api.songs.listTracks(song.id)
  return Promise.all(tracks.map(async track => {
    const [scene, license] = await Promise.all([
      api.scenes.get(track.scene_id).catch(() => undefined),
      api.tracks.getLicense(track.id).catch(() => null),
    ])
    const [movie, offers] = await Promise.all([
      scene ? api.movies.get(scene.movie_id).catch(() => undefined) : Promise.resolve(undefined),
      license && license.status !== 'DRAFT'
        ? api.licenses.listOffers(license.id).catch(() => [])
        : Promise.resolve([]),
    ])
    return {
      track,
      scene,
      movie,
      license: license?.status === 'DRAFT' ? null : license,
      offers,
    }
  }))
}

export async function loadRightsLicenses(persona: RightsPersona): Promise<RightsLicenseItem[]> {
  const songs = await loadRightsSongs(persona)
  const placementsBySong = await Promise.all(songs.map(async song => ({
    song,
    placements: await loadSongPlacements(song),
  })))

  return placementsBySong.flatMap(({ song, placements }) => placements
    .filter((placement): placement is SongPlacement & { license: LicenseRequest } => placement.license !== null)
    .map(placement => ({
      license: placement.license,
      offers: placement.offers,
      latestOffer: [...placement.offers].sort((a, b) => b.offer_number - a.offer_number)[0],
      track: placement.track,
      song,
      scene: placement.scene,
      movie: placement.movie,
    })))
    .sort((a, b) => new Date(b.license.updated_at).getTime() - new Date(a.license.updated_at).getTime())
}

export async function loadRightsLicenseDetail(
  persona: RightsPersona,
  licenseId: string,
): Promise<RightsLicenseItem | null> {
  const items = await loadRightsLicenses(persona)
  return items.find(item => item.license.id === licenseId) ?? null
}
