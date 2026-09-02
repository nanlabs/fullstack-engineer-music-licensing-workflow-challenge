// In-memory seed data + mutable store for the mock API backend.
// Shapes mirror backend responses exactly (see backend/src/*/model.rs).

import type {
  Label,
  LabelMember,
  LicenseOffer,
  LicenseRequest,
  Movie,
  MovieMember,
  Scene,
  Song,
  Track,
} from '@/types'

function uuid(seed: string): string {
  // Deterministic-looking fake UUIDs, stable across reloads. Hashed so the
  // leading segment (used for short display ids like "License #a3f9c21e")
  // is distinct per seed instead of just echoing a shared prefix.
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0
  }
  const hex = Math.abs(hash).toString(16).padEnd(8, '0').slice(0, 8)
  const body = `${hex}${seed}`.padEnd(32, '0').slice(0, 32)
  return `${body.slice(0, 8)}-${body.slice(8, 12)}-${body.slice(12, 16)}-${body.slice(16, 20)}-${body.slice(20, 32)}`
}

export const USERS = {
  producer: { id: uuid('user-producer'), name: 'Jordan Blake', email: 'jordan@studio.dev' },
  supervisor: { id: uuid('user-supervisor'), name: 'Casey Reyes', email: 'casey@studio.dev' },
  artist: { id: uuid('user-artist'), name: 'Nova Chen', email: 'nova@indie.dev' },
  labelManager: { id: uuid('user-label-mgr'), name: 'Priya Anand', email: 'priya@wavelabel.dev' },
  labelRep: { id: uuid('user-label-rep'), name: 'Mateo Ruiz', email: 'mateo@wavelabel.dev' },
  admin: { id: uuid('user-admin'), name: 'Sam Okafor', email: 'sam@studio.dev' },
}

export const USER_NAMES: Record<string, string> = Object.fromEntries(
  Object.values(USERS).map(u => [u.id, u.name]),
)

const now = () => new Date().toISOString()
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

// ─── Labels ───
export const labels: Label[] = [
  {
    id: uuid('label-wave'),
    name: 'Wave Records',
    website: 'https://waverecords.example',
    contact_email: 'licensing@waverecords.example',
    created_at: daysAgo(200),
    updated_at: daysAgo(10),
  },
  {
    id: uuid('label-indie'),
    name: 'Indie Frequency',
    website: null,
    contact_email: 'hello@indiefrequency.example',
    created_at: daysAgo(150),
    updated_at: daysAgo(30),
  },
]

export const labelMembers: (LabelMember & { label_id: string })[] = [
  { label_id: labels[0].id, user_id: USERS.labelManager.id, user_name: USERS.labelManager.name, role: 'OWNER', joined_at: daysAgo(200) },
  { label_id: labels[0].id, user_id: USERS.labelRep.id, user_name: USERS.labelRep.name, role: 'REP', joined_at: daysAgo(165) },
  { label_id: labels[0].id, user_id: USERS.artist.id, user_name: USERS.artist.name, role: 'ARTIST', joined_at: daysAgo(120) },
]

// ─── Movies ───
export const movies: Movie[] = [
  {
    id: uuid('movie-cyber'),
    title: 'Cyber City',
    description: 'A neo-noir thriller set in 2085',
    release_year: 2026,
    director: 'Jane Doe',
    created_by: USERS.producer.id,
    created_by_name: USERS.producer.name,
    created_at: daysAgo(90),
    updated_at: daysAgo(5),
  },
  {
    id: uuid('movie-lastlight'),
    title: 'Last Light',
    description: 'A road movie about the end of the world',
    release_year: 2025,
    director: 'Marco Silva',
    created_by: USERS.producer.id,
    created_by_name: USERS.producer.name,
    created_at: daysAgo(400),
    updated_at: daysAgo(60),
  },
]

export const movieMembers: (MovieMember & { movie_id: string })[] = [
  { movie_id: movies[0].id, user_id: USERS.producer.id, user_name: USERS.producer.name, role: 'OWNER', joined_at: daysAgo(90) },
  { movie_id: movies[0].id, user_id: USERS.supervisor.id, user_name: USERS.supervisor.name, role: 'SUPERVISOR', joined_at: daysAgo(85) },
]

// ─── Scenes ───
export const scenes: Scene[] = [
  {
    id: uuid('scene-opening'),
    movie_id: movies[0].id,
    title: 'Opening Chase',
    scene_number: 1,
    description: 'High-speed chase through neon streets',
    start_time: 0,
    end_time: 180,
    duration_seconds: 180,
    created_at: daysAgo(88),
    updated_at: daysAgo(20),
  },
  {
    id: uuid('scene-rooftop'),
    movie_id: movies[0].id,
    title: 'Rooftop Confrontation',
    scene_number: 7,
    description: 'Climactic rooftop standoff',
    start_time: 4200,
    end_time: 4380,
    duration_seconds: 180,
    created_at: daysAgo(80),
    updated_at: daysAgo(15),
  },
  {
    id: uuid('scene-credits'),
    movie_id: movies[0].id,
    title: 'End Credits',
    scene_number: 20,
    description: null,
    start_time: 6000,
    end_time: 6300,
    duration_seconds: 300,
    created_at: daysAgo(75),
    updated_at: daysAgo(75),
  },
]

// ─── Songs ───
export const songs: Song[] = [
  {
    id: uuid('song-neon'),
    title: 'Neon Lights',
    artist_id: USERS.artist.id,
    artist_name: USERS.artist.name,
    label_id: labels[0].id,
    label_name: labels[0].name,
    album: 'Electric Dreams',
    duration_seconds: 240,
    genre: 'Electronic',
    isrc: 'US-RC1-76-07839',
    created_at: daysAgo(300),
    updated_at: daysAgo(300),
  },
  {
    id: uuid('song-static'),
    title: 'Static Heartbeat',
    artist_id: USERS.artist.id,
    artist_name: USERS.artist.name,
    label_id: labels[0].id,
    label_name: labels[0].name,
    album: 'Electric Dreams',
    duration_seconds: 195,
    genre: 'Synthwave',
    isrc: 'US-RC1-76-07840',
    created_at: daysAgo(300),
    updated_at: daysAgo(300),
  },
  {
    id: uuid('song-driftaway'),
    title: 'Drift Away',
    artist_id: USERS.artist.id,
    artist_name: USERS.artist.name,
    label_id: null,
    label_name: null,
    album: null,
    duration_seconds: 210,
    genre: 'Ambient',
    isrc: null,
    created_at: daysAgo(60),
    updated_at: daysAgo(60),
  },
]

// ─── Tracks ───
export const tracks: Track[] = [
  {
    id: uuid('track-opening-neon'),
    scene_id: scenes[0].id,
    song_id: songs[0].id,
    usage_type: 'FEATURED',
    start_time_seconds: 12,
    end_time_seconds: 45,
    duration_seconds: 33,
    created_by: USERS.supervisor.id,
    created_by_name: USERS.supervisor.name,
    notes: 'Needle drop at the 0:12 mark',
    created_at: daysAgo(70),
    updated_at: daysAgo(70),
  },
  {
    id: uuid('track-rooftop-static'),
    scene_id: scenes[1].id,
    song_id: songs[1].id,
    usage_type: 'BACKGROUND',
    start_time_seconds: 0,
    end_time_seconds: 60,
    duration_seconds: 60,
    created_by: USERS.supervisor.id,
    created_by_name: USERS.supervisor.name,
    notes: null,
    created_at: daysAgo(60),
    updated_at: daysAgo(60),
  },
  {
    id: uuid('track-credits-drift'),
    scene_id: scenes[2].id,
    song_id: songs[2].id,
    usage_type: 'CREDITS',
    start_time_seconds: 0,
    end_time_seconds: 90,
    duration_seconds: 90,
    created_by: USERS.supervisor.id,
    created_by_name: USERS.supervisor.name,
    notes: null,
    created_at: daysAgo(40),
    updated_at: daysAgo(40),
  },
  {
    id: uuid('track-opening-drift'),
    scene_id: scenes[0].id,
    song_id: songs[2].id,
    usage_type: 'TRAILER',
    start_time_seconds: 30,
    end_time_seconds: 75,
    duration_seconds: 45,
    created_by: USERS.supervisor.id,
    created_by_name: USERS.supervisor.name,
    notes: 'Trailer cut for the international campaign',
    created_at: daysAgo(8),
    updated_at: daysAgo(3),
  },
]

// ─── Licenses ───
export const licenseRequests: LicenseRequest[] = [
  {
    id: uuid('license-opening'),
    track_id: tracks[0].id,
    status: 'APPROVED',
    requested_by: USERS.supervisor.id,
    requested_by_name: USERS.supervisor.name,
    requested_at: daysAgo(25),
    resolved_by: USERS.labelManager.id,
    resolved_by_name: USERS.labelManager.name,
    resolved_at: daysAgo(18),
    rejection_reason: null,
    created_at: daysAgo(25),
    updated_at: daysAgo(18),
  },
  {
    id: uuid('license-rooftop'),
    track_id: tracks[1].id,
    status: 'REQUESTED',
    requested_by: USERS.supervisor.id,
    requested_by_name: USERS.supervisor.name,
    requested_at: daysAgo(10),
    resolved_by: null,
    resolved_by_name: null,
    resolved_at: null,
    rejection_reason: null,
    created_at: daysAgo(10),
    updated_at: daysAgo(2),
  },
  {
    id: uuid('license-credits'),
    track_id: tracks[2].id,
    status: 'DRAFT',
    requested_by: USERS.supervisor.id,
    requested_by_name: USERS.supervisor.name,
    requested_at: daysAgo(1),
    resolved_by: null,
    resolved_by_name: null,
    resolved_at: null,
    rejection_reason: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
  },
  {
    id: uuid('license-independent'),
    track_id: tracks[3].id,
    status: 'REQUESTED',
    requested_by: USERS.supervisor.id,
    requested_by_name: USERS.supervisor.name,
    requested_at: daysAgo(8),
    resolved_by: null,
    resolved_by_name: null,
    resolved_at: null,
    rejection_reason: null,
    created_at: daysAgo(8),
    updated_at: daysAgo(3),
  },
]

export const licenseOffers: LicenseOffer[] = [
  {
    id: uuid('offer-opening-1'),
    license_request_id: licenseRequests[0].id,
    offer_number: 1,
    side: 'MOVIE_TEAM',
    proposed_by: USERS.supervisor.id,
    proposed_by_name: USERS.supervisor.name,
    license_fee: 5000,
    currency: 'USD',
    territory: 'Worldwide',
    media_rights: 'Theatrical, streaming',
    license_start: null,
    license_end: null,
    exclusive: false,
    notes: 'Initial offer for opening scene placement',
    created_at: daysAgo(25),
  },
  {
    id: uuid('offer-opening-2'),
    license_request_id: licenseRequests[0].id,
    offer_number: 2,
    side: 'RIGHTS_HOLDER',
    proposed_by: USERS.labelManager.id,
    proposed_by_name: USERS.labelManager.name,
    license_fee: 8000,
    currency: 'USD',
    territory: 'Worldwide',
    media_rights: 'Theatrical, streaming',
    license_start: null,
    license_end: null,
    exclusive: true,
    notes: 'Counter: higher fee for exclusive rights',
    created_at: daysAgo(22),
  },
  {
    id: uuid('offer-opening-3'),
    license_request_id: licenseRequests[0].id,
    offer_number: 3,
    side: 'MOVIE_TEAM',
    proposed_by: USERS.supervisor.id,
    proposed_by_name: USERS.supervisor.name,
    license_fee: 6500,
    currency: 'USD',
    territory: 'Worldwide',
    media_rights: 'Theatrical, streaming',
    license_start: null,
    license_end: null,
    exclusive: true,
    notes: 'Final compromise',
    created_at: daysAgo(18),
  },
  {
    id: uuid('offer-rooftop-1'),
    license_request_id: licenseRequests[1].id,
    offer_number: 1,
    side: 'MOVIE_TEAM',
    proposed_by: USERS.supervisor.id,
    proposed_by_name: USERS.supervisor.name,
    license_fee: 3000,
    currency: 'USD',
    territory: 'North America',
    media_rights: 'Theatrical',
    license_start: null,
    license_end: null,
    exclusive: false,
    notes: 'Background placement, single scene',
    created_at: daysAgo(10),
  },
  {
    id: uuid('offer-credits-1'),
    license_request_id: licenseRequests[2].id,
    offer_number: 1,
    side: 'MOVIE_TEAM',
    proposed_by: USERS.supervisor.id,
    proposed_by_name: USERS.supervisor.name,
    license_fee: 1500,
    currency: 'USD',
    territory: 'Worldwide',
    media_rights: 'Credits only',
    license_start: null,
    license_end: null,
    exclusive: false,
    notes: 'Draft — not yet submitted',
    created_at: daysAgo(1),
  },
  {
    id: uuid('offer-independent-1'),
    license_request_id: licenseRequests[3].id,
    offer_number: 1,
    side: 'MOVIE_TEAM',
    proposed_by: USERS.supervisor.id,
    proposed_by_name: USERS.supervisor.name,
    license_fee: 2200,
    currency: 'USD',
    territory: 'Worldwide',
    media_rights: 'Trailer, digital advertising',
    license_start: null,
    license_end: null,
    exclusive: false,
    notes: 'International trailer campaign for Cyber City',
    created_at: daysAgo(8),
  },
]

export function nowIso() {
  return now()
}
