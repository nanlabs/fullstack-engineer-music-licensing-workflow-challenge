// In-memory mock implementation of the `Api` contract. Simulates network
// latency and mirrors the real backend's validation rules / error shapes
// (see backend/src/*/model.rs `validate()` and backend/src/error).

import { ApiError } from '../error'
import type {
  AuthApi,
  LabelsApi,
  LicensesApi,
  MoviesApi,
  ScenesApi,
  SongsApi,
  TracksApi,
} from '../types'
import type {
  Label,
  LabelMember,
  LicenseEvent,
  LicenseOffer,
  LicenseRequest,
  MeResponse,
  Movie,
  MovieMember,
  Scene,
  SessionResponse,
  Song,
  TokenResponse,
  Track,
} from '@/types'
import {
  USER_NAMES,
  USERS,
  labelMembers,
  labels,
  licenseOffers,
  licenseRequests,
  movieMembers,
  movies,
  nowIso,
  scenes,
  songs,
  tracks,
} from './data'
import { getMockActorId } from './actor'

const MOCK_LATENCY_MS = 250

function delay<T>(value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), MOCK_LATENCY_MS))
}

function notFound(what: string): never {
  throw ApiError.of(404, 'NOT_FOUND', `${what} not found`, 'NOT_FOUND')
}

function validation(message: string, field?: string): never {
  throw ApiError.of(400, 'VALIDATION_ERROR', message, 'VALIDATION', field ? { field } : undefined)
}

function conflict(message: string): never {
  throw ApiError.of(409, 'CONFLICT', message, 'CONFLICT')
}

function business(message: string): never {
  throw ApiError.of(422, 'BUSINESS_ERROR', message, 'BUSINESS')
}

function genId(prefix: string): string {
  // Random segment first so short display ids (e.g. slice(0, 8)) are
  // distinct per record instead of all sharing the same prefix.
  return `${Math.random().toString(36).slice(2, 10)}-${prefix}-${Date.now().toString(36)}`
}

function paginate<T>(items: T[], page = 1, pageSize = 20) {
  const total = items.length
  const start = (page - 1) * pageSize
  const pageItems = items.slice(start, start + pageSize)
  return {
    items: pageItems,
    pagination: {
      page,
      page_size: pageSize,
      total,
      pages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
    },
  }
}

// ─── Movies ───
const moviesApi: MoviesApi = {
  async create(body) {
    if (!body.title.trim()) validation('Title is required', 'title')
    if (body.release_year != null && (body.release_year < 1888 || body.release_year > 2100)) {
      validation('Release year must be between 1888 and 2100', 'release_year')
    }
    const movie: Movie = {
      id: genId('movie'),
      title: body.title,
      description: body.description ?? null,
      release_year: body.release_year ?? null,
      director: body.director ?? null,
      created_by: USERS.producer.id,
      created_by_name: USERS.producer.name,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    movies.push(movie)
    return delay(movie)
  },
  async find(query) {
    let items = movies
    if (query.search) {
      const q = query.search.toLowerCase()
      items = items.filter(m => m.title.toLowerCase().includes(q))
    }
    if (query.created_by) {
      items = items.filter(m => m.created_by === query.created_by)
    }
    return delay(paginate(items, query.page, query.page_size))
  },
  async get(id) {
    const movie = movies.find(m => m.id === id) ?? notFound('Movie')
    return delay(movie)
  },
  async update(id, body) {
    const movie = movies.find(m => m.id === id) ?? notFound('Movie')
    if (body.title !== undefined && body.title !== null && !body.title.trim()) {
      validation('Title cannot be empty', 'title')
    }
    if (body.title != null) movie.title = body.title
    if (body.description !== undefined) movie.description = body.description
    if (body.release_year !== undefined) movie.release_year = body.release_year
    if (body.director !== undefined) movie.director = body.director
    movie.updated_at = nowIso()
    return delay(movie)
  },
  async delete(id) {
    const idx = movies.findIndex(m => m.id === id)
    if (idx === -1) notFound('Movie')
    movies.splice(idx, 1)
    return delay(undefined)
  },
  async myMovies() {
    return delay(movies)
  },
  async addMember(id, body) {
    if (!movies.some(m => m.id === id)) notFound('Movie')
    if (movieMembers.some(m => m.movie_id === id && m.user_id === body.user_id)) {
      conflict('User is already a member')
    }
    const member = {
      movie_id: id,
      user_id: body.user_id,
      user_name: USER_NAMES[body.user_id] ?? null,
      role: body.role ?? 'VIEWER',
      joined_at: nowIso(),
    } as MovieMember & { movie_id: string }
    movieMembers.push(member)
    return delay(member)
  },
  async removeMember(id, userId) {
    if (!movies.some(m => m.id === id)) notFound('Movie')
    const idx = movieMembers.findIndex(m => m.movie_id === id && m.user_id === userId)
    if (idx === -1) notFound('Member')
    movieMembers.splice(idx, 1)
    return delay(undefined)
  },
  async listMembers(id) {
    if (!movies.some(m => m.id === id)) notFound('Movie')
    return delay(movieMembers.filter(m => m.movie_id === id))
  },
  async listScenes(id) {
    const movie = movies.find(m => m.id === id) ?? notFound('Movie')
    void movie
    return delay(scenes.filter(s => s.movie_id === id))
  },
}

// ─── Scenes ───
const scenesApi: ScenesApi = {
  async create(body) {
    if (!body.title.trim()) validation('Title is required', 'title')
    if (body.scene_number < 1) validation('Scene number must be positive', 'scene_number')
    if (body.start_time < 0) validation('Start time cannot be negative', 'start_time')
    if (body.end_time <= body.start_time) validation('End time must be greater than start time', 'end_time')
    if (!movies.some(m => m.id === body.movie_id)) notFound('Movie')

    const scene: Scene = {
      id: genId('scene'),
      movie_id: body.movie_id,
      title: body.title,
      scene_number: body.scene_number,
      description: body.description ?? null,
      start_time: body.start_time,
      end_time: body.end_time,
      duration_seconds: body.end_time - body.start_time,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    scenes.push(scene)
    return delay(scene)
  },
  async get(id) {
    const scene = scenes.find(s => s.id === id) ?? notFound('Scene')
    return delay(scene)
  },
  async update(id, body) {
    const scene = scenes.find(s => s.id === id) ?? notFound('Scene')
    if (body.title !== undefined && body.title !== null && !body.title.trim()) {
      validation('Title cannot be empty', 'title')
    }
    if (body.title != null) scene.title = body.title
    if (body.scene_number != null) scene.scene_number = body.scene_number
    if (body.description !== undefined) scene.description = body.description
    if (body.start_time != null) scene.start_time = body.start_time
    if (body.end_time != null) scene.end_time = body.end_time
    scene.duration_seconds = scene.end_time - scene.start_time
    scene.updated_at = nowIso()
    return delay(scene)
  },
  async delete(id) {
    const idx = scenes.findIndex(s => s.id === id)
    if (idx === -1) notFound('Scene')
    scenes.splice(idx, 1)
    return delay(undefined)
  },
  async listTracks(id) {
    const scene = scenes.find(s => s.id === id) ?? notFound('Scene')
    void scene
    return delay(tracks.filter(t => t.scene_id === id))
  },
}

// ─── Songs ───
const songsApi: SongsApi = {
  async create(body) {
    if (!body.title.trim()) validation('Title is required', 'title')
    if (body.duration_seconds <= 0) validation('Duration must be positive', 'duration_seconds')
    const song: Song = {
      id: genId('song'),
      title: body.title,
      artist_id: body.artist_id,
      artist_name: USER_NAMES[body.artist_id] ?? null,
      label_id: body.label_id ?? null,
      label_name: body.label_id ? (labels.find(l => l.id === body.label_id)?.name ?? null) : null,
      album: body.album ?? null,
      duration_seconds: body.duration_seconds,
      genre: body.genre ?? null,
      isrc: body.isrc ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    songs.push(song)
    return delay(song)
  },
  async find(query) {
    let items = songs
    if (query.search) {
      const q = query.search.toLowerCase()
      items = items.filter(s => s.title.toLowerCase().includes(q))
    }
    if (query.artist_id) items = items.filter(s => s.artist_id === query.artist_id)
    if (query.label_id) items = items.filter(s => s.label_id === query.label_id)
    if (query.genre) items = items.filter(s => s.genre === query.genre)
    return delay(paginate(items, query.page, query.page_size))
  },
  async get(id) {
    const song = songs.find(s => s.id === id) ?? notFound('Song')
    return delay(song)
  },
  async update(id, body) {
    const song = songs.find(s => s.id === id) ?? notFound('Song')
    if (body.title !== undefined && body.title !== null && !body.title.trim()) {
      validation('Title cannot be empty', 'title')
    }
    if (body.duration_seconds != null && body.duration_seconds <= 0) {
      validation('Duration must be positive', 'duration_seconds')
    }
    if (body.title != null) song.title = body.title
    if (body.album !== undefined) song.album = body.album
    if (body.genre !== undefined) song.genre = body.genre
    if (body.isrc !== undefined) song.isrc = body.isrc
    if (body.duration_seconds != null) song.duration_seconds = body.duration_seconds
    song.updated_at = nowIso()
    return delay(song)
  },
  async delete(id) {
    const idx = songs.findIndex(s => s.id === id)
    if (idx === -1) notFound('Song')
    songs.splice(idx, 1)
    return delay(undefined)
  },
  async listByArtist(artistId) {
    return delay(songs.filter(s => s.artist_id === artistId))
  },
  async listTracks(id) {
    const song = songs.find(s => s.id === id) ?? notFound('Song')
    void song
    return delay(tracks.filter(t => t.song_id === id))
  },
}

// ─── Tracks ───
const tracksApi: TracksApi = {
  async create(body) {
    if (!scenes.some(s => s.id === body.scene_id)) notFound('Scene')
    if (!songs.some(s => s.id === body.song_id)) notFound('Song')
    const track: Track = {
      id: genId('track'),
      scene_id: body.scene_id,
      song_id: body.song_id,
      usage_type: body.usage_type,
      start_time_seconds: body.start_time_seconds,
      end_time_seconds: body.end_time_seconds,
      duration_seconds: body.end_time_seconds - body.start_time_seconds,
      created_by: USERS.supervisor.id,
      created_by_name: USERS.supervisor.name,
      notes: body.notes ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    tracks.push(track)
    return delay(track)
  },
  async get(id) {
    const track = tracks.find(t => t.id === id) ?? notFound('Track')
    return delay(track)
  },
  async update(id, body) {
    const track = tracks.find(t => t.id === id) ?? notFound('Track')
    if (body.usage_type != null) track.usage_type = body.usage_type
    if (body.start_time_seconds != null) track.start_time_seconds = body.start_time_seconds
    if (body.end_time_seconds != null) track.end_time_seconds = body.end_time_seconds
    track.duration_seconds = track.end_time_seconds - track.start_time_seconds
    if (body.notes !== undefined) track.notes = body.notes
    track.updated_at = nowIso()
    return delay(track)
  },
  async delete(id) {
    const idx = tracks.findIndex(t => t.id === id)
    if (idx === -1) notFound('Track')
    tracks.splice(idx, 1)
    return delay(undefined)
  },
  async getLicense(id) {
    const track = tracks.find(t => t.id === id) ?? notFound('Track')
    const license = licenseRequests.find(l => l.track_id === track.id) ?? null
    return delay(license)
  },
}

// ─── Labels ───
const labelsApi: LabelsApi = {
  async create(body) {
    if (body.name.trim().length < 2) validation('Name is required and must be at least 2 characters', 'name')
    const label: Label = {
      id: genId('label'),
      name: body.name,
      website: body.website ?? null,
      contact_email: body.contact_email ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    labels.push(label)
    return delay(label)
  },
  async list() {
    return delay(labels)
  },
  async get(id) {
    const label = labels.find(l => l.id === id) ?? notFound('Label')
    return delay(label)
  },
  async update(id, body) {
    const label = labels.find(l => l.id === id) ?? notFound('Label')
    if (body.name != null && body.name.trim().length < 2) {
      validation('Name must be at least 2 characters', 'name')
    }
    if (body.name != null) label.name = body.name
    if (body.website !== undefined) label.website = body.website
    if (body.contact_email !== undefined) label.contact_email = body.contact_email
    label.updated_at = nowIso()
    return delay(label)
  },
  async delete(id) {
    const idx = labels.findIndex(l => l.id === id)
    if (idx === -1) notFound('Label')
    labels.splice(idx, 1)
    return delay(undefined)
  },
  async addMember(id, body) {
    if (!labels.some(l => l.id === id)) notFound('Label')
    if (labelMembers.some(m => m.label_id === id && m.user_id === body.user_id)) {
      conflict('User is already a member')
    }
    const member = {
      label_id: id,
      user_id: body.user_id,
      user_name: USER_NAMES[body.user_id] ?? null,
      role: body.role ?? 'ARTIST',
      joined_at: nowIso(),
    } as LabelMember & { label_id: string }
    labelMembers.push(member)
    return delay(member)
  },
  async removeMember(id, userId) {
    if (!labels.some(l => l.id === id)) notFound('Label')
    const idx = labelMembers.findIndex(m => m.label_id === id && m.user_id === userId)
    if (idx === -1) notFound('Member')
    labelMembers.splice(idx, 1)
    return delay(undefined)
  },
  async listMembers(id) {
    if (!labels.some(l => l.id === id)) notFound('Label')
    return delay(labelMembers.filter(m => m.label_id === id))
  },
  async getUserLabels(userId) {
    const labelIds = new Set(labelMembers.filter(m => m.user_id === userId).map(m => m.label_id))
    return delay(labels.filter(l => labelIds.has(l.id)))
  },
  async listSongs(id) {
    const label = labels.find(l => l.id === id) ?? notFound('Label')
    void label
    return delay(songs.filter(s => s.label_id === id))
  },
}

// ─── Licenses ───
const eventListeners = new Set<(event: LicenseEvent) => void>()

function emitLicenseEvent(event: LicenseEvent) {
  eventListeners.forEach(listener => listener(event))
}

function latestOffer(licenseId: string): LicenseOffer {
  const offers = licenseOffers
    .filter(o => o.license_request_id === licenseId)
    .sort((a, b) => b.offer_number - a.offer_number)
  return offers[0]
}

const licensesApi: LicensesApi = {
  async create(body) {
    if (!tracks.some(t => t.id === body.track_id)) notFound('Track')
    if (licenseRequests.some(l => l.track_id === body.track_id)) {
      conflict('A license request already exists for this track')
    }
    const license: LicenseRequest = {
      id: genId('license'),
      track_id: body.track_id,
      status: 'DRAFT',
      requested_by: USERS.supervisor.id,
      requested_by_name: USERS.supervisor.name,
      requested_at: nowIso(),
      resolved_by: null,
      resolved_by_name: null,
      resolved_at: null,
      rejection_reason: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    const offer: LicenseOffer = {
      id: genId('offer'),
      license_request_id: license.id,
      offer_number: 1,
      side: 'MOVIE_TEAM',
      proposed_by: USERS.supervisor.id,
      proposed_by_name: USERS.supervisor.name,
      license_fee: body.license_fee ?? null,
      currency: body.currency ?? null,
      territory: body.territory ?? null,
      media_rights: body.media_rights ?? null,
      license_start: body.license_start ?? null,
      license_end: body.license_end ?? null,
      exclusive: body.exclusive ?? false,
      notes: body.notes ?? null,
      created_at: nowIso(),
    }
    licenseRequests.push(license)
    licenseOffers.push(offer)
    return delay({ license, offer })
  },
  async get(id) {
    const license = licenseRequests.find(l => l.id === id) ?? notFound('License request')
    return delay(license)
  },
  async listOffers(id) {
    if (!licenseRequests.some(l => l.id === id)) notFound('License request')
    return delay(
      licenseOffers
        .filter(o => o.license_request_id === id)
        .sort((a, b) => a.offer_number - b.offer_number),
    )
  },
  async reviseDraft(id, body) {
    const license = licenseRequests.find(l => l.id === id) ?? notFound('License request')
    if (license.status !== 'DRAFT') business('License request is not a draft')
    const offer = latestOffer(id)
    Object.assign(offer, {
      license_fee: body.license_fee ?? offer.license_fee,
      currency: body.currency ?? offer.currency,
      territory: body.territory ?? offer.territory,
      media_rights: body.media_rights ?? offer.media_rights,
      license_start: body.license_start ?? offer.license_start,
      license_end: body.license_end ?? offer.license_end,
      exclusive: body.exclusive ?? offer.exclusive,
      notes: body.notes ?? offer.notes,
    })
    license.updated_at = nowIso()
    return delay(offer)
  },
  async submit(id) {
    const license = licenseRequests.find(l => l.id === id) ?? notFound('License request')
    if (license.status !== 'DRAFT') business('License request is not a draft')
    license.status = 'REQUESTED'
    license.updated_at = nowIso()
    emitLicenseEvent({
      license_id: license.id,
      track_id: license.track_id,
      kind: 'submitted',
      actor: USERS.supervisor.id,
      actor_name: USER_NAMES[USERS.supervisor.id] ?? 'Unknown',
      timestamp: nowIso(),
    })
    return delay(license)
  },
  async counterOffer(id, body) {
    const license = licenseRequests.find(l => l.id === id) ?? notFound('License request')
    if (license.status !== 'REQUESTED') business('License is not negotiable')
    const last = latestOffer(id)
    const side = last.side === 'MOVIE_TEAM' ? 'RIGHTS_HOLDER' : 'MOVIE_TEAM'
    const proposedBy = side === 'MOVIE_TEAM'
      ? USERS.supervisor.id
      : getMockActorId() ?? USERS.labelManager.id
    const offer: LicenseOffer = {
      id: genId('offer'),
      license_request_id: id,
      offer_number: last.offer_number + 1,
      side,
      proposed_by: proposedBy,
      proposed_by_name: USER_NAMES[proposedBy] ?? null,
      license_fee: body.license_fee ?? null,
      currency: body.currency ?? last.currency,
      territory: body.territory ?? last.territory,
      media_rights: body.media_rights ?? last.media_rights,
      license_start: body.license_start ?? last.license_start,
      license_end: body.license_end ?? last.license_end,
      exclusive: body.exclusive ?? last.exclusive,
      notes: body.notes ?? null,
      created_at: nowIso(),
    }
    licenseOffers.push(offer)
    license.updated_at = nowIso()
    emitLicenseEvent({
      license_id: license.id,
      track_id: license.track_id,
      kind: 'counter_offer',
      actor: proposedBy,
      actor_name: USER_NAMES[proposedBy] ?? 'Unknown',
      timestamp: nowIso(),
    })
    return delay(offer)
  },
  async accept(id) {
    const license = licenseRequests.find(l => l.id === id) ?? notFound('License request')
    if (license.status !== 'REQUESTED') business('License request cannot be accepted in its current state')
    license.status = 'APPROVED'
    license.resolved_by = getMockActorId() ?? USERS.labelManager.id
    license.resolved_by_name = USER_NAMES[license.resolved_by] ?? null
    license.resolved_at = nowIso()
    license.updated_at = nowIso()
    emitLicenseEvent({
      license_id: license.id,
      track_id: license.track_id,
      kind: 'accepted',
      actor: license.resolved_by,
      actor_name: USER_NAMES[license.resolved_by] ?? 'Unknown',
      timestamp: nowIso(),
    })
    return delay(license)
  },
  async reject(id, reason) {
    const license = licenseRequests.find(l => l.id === id) ?? notFound('License request')
    if (license.status !== 'REQUESTED') business('License request cannot be rejected in its current state')
    license.status = 'REJECTED'
    license.resolved_by = getMockActorId() ?? USERS.labelManager.id
    license.resolved_by_name = USER_NAMES[license.resolved_by] ?? null
    license.resolved_at = nowIso()
    license.rejection_reason = reason
    license.updated_at = nowIso()
    emitLicenseEvent({
      license_id: license.id,
      track_id: license.track_id,
      kind: 'rejected',
      actor: license.resolved_by,
      actor_name: USER_NAMES[license.resolved_by] ?? 'Unknown',
      timestamp: nowIso(),
    })
    return delay(license)
  },
  async cancel(id) {
    const license = licenseRequests.find(l => l.id === id) ?? notFound('License request')
    if (license.status !== 'DRAFT' && license.status !== 'REQUESTED') {
      business('License request cannot be cancelled in its current state')
    }
    license.status = 'CANCELLED'
    license.updated_at = nowIso()
    emitLicenseEvent({
      license_id: license.id,
      track_id: license.track_id,
      kind: 'cancelled',
      actor: USERS.supervisor.id,
      actor_name: USER_NAMES[USERS.supervisor.id] ?? 'Unknown',
      timestamp: nowIso(),
    })
    return delay(license)
  },
  async delete(id) {
    const idx = licenseRequests.findIndex(l => l.id === id)
    if (idx === -1) notFound('License request')
    if (licenseRequests[idx].status !== 'DRAFT') business('Only drafts can be deleted')
    licenseRequests.splice(idx, 1)
    return delay(undefined)
  },
  subscribeEvents(onEvent) {
    eventListeners.add(onEvent)
    return () => eventListeners.delete(onEvent)
  },
}

// ─── Auth ───
const MOCK_TOKEN_TTL_SECONDS = 3600

function mockTokenPair(): TokenResponse {
  return {
    access_token: `mock-access-${genId('tok')}`,
    refresh_token: `mock-refresh-${genId('tok')}`,
    token_type: 'Bearer',
    expires_in: MOCK_TOKEN_TTL_SECONDS,
  }
}

const authApi: AuthApi = {
  async login(body) {
    if (!body.email || !body.password) {
      throw ApiError.of(401, 'INVALID_CREDENTIALS', 'Invalid credentials', 'AUTHORIZATION')
    }
    return delay(mockTokenPair())
  },
  async refresh(_refreshToken) {
    return delay(mockTokenPair())
  },
  async logout(_refreshToken) {
    return delay(undefined)
  },
  async logoutAll() {
    return delay(undefined)
  },
  async me() {
    const res: MeResponse = {
      user_id: USERS.supervisor.id,
      email: USERS.supervisor.email,
      name: USERS.supervisor.name,
      scopes: ['*'],
    }
    return delay(res)
  },
  async listSessions() {
    const session: SessionResponse = {
      id: genId('session'),
      ip_address: '127.0.0.1',
      user_agent: 'Mock Browser',
      created_at: nowIso(),
      last_activity: nowIso(),
      expires_at: nowIso(),
    }
    return delay([session])
  },
  async revokeSession() {
    return delay(undefined)
  },
}

export const mockApi = {
  auth: authApi,
  movies: moviesApi,
  scenes: scenesApi,
  songs: songsApi,
  tracks: tracksApi,
  labels: labelsApi,
  licenses: licensesApi,
}

export { USER_NAMES }
