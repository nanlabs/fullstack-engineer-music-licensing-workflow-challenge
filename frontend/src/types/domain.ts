// Domain types mirroring backend API responses
// Keep in sync with backend/src/*/model.rs

export type UUID = string

// ─── Movies ───
export type MovieRole = 'OWNER' | 'SUPERVISOR' | 'EDITOR' | 'VIEWER'

export interface Movie {
  id: UUID
  title: string
  description: string | null
  release_year: number | null
  director: string | null
  created_by: UUID
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface MovieMember {
  user_id: UUID
  user_name: string | null
  role: MovieRole
  joined_at: string
}

// ─── Scenes ───
export interface Scene {
  id: UUID
  movie_id: UUID
  title: string
  scene_number: number
  description: string | null
  start_time: number
  end_time: number
  duration_seconds: number
  created_at: string
  updated_at: string
}

// ─── Songs ───
export interface Song {
  id: UUID
  title: string
  artist_id: UUID
  artist_name: string | null
  label_id: UUID | null
  label_name: string | null
  album: string | null
  duration_seconds: number
  genre: string | null
  isrc: string | null
  created_at: string
  updated_at: string
}

// ─── Tracks ───
export type UsageType = 'BACKGROUND' | 'FEATURED' | 'CREDITS' | 'TRAILER'

export interface Track {
  id: UUID
  scene_id: UUID
  song_id: UUID
  usage_type: UsageType
  /** Start of the excerpt within the song's own timeline, in seconds. */
  start_time_seconds: number
  /** End of the excerpt within the song's own timeline, in seconds. */
  end_time_seconds: number
  duration_seconds: number
  created_by: UUID
  created_by_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Labels ───
export type LabelRole = 'OWNER' | 'REP' | 'ARTIST'

export interface Label {
  id: UUID
  name: string
  website: string | null
  contact_email: string | null
  created_at: string
  updated_at: string
}

export interface LabelMember {
  user_id: UUID
  user_name: string | null
  role: LabelRole
  joined_at: string
}

// ─── Licenses ───
export type LicenseStatus = 'DRAFT' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type NegotiationSide = 'MOVIE_TEAM' | 'RIGHTS_HOLDER'

export interface LicenseRequest {
  id: UUID
  track_id: UUID
  status: LicenseStatus
  requested_by: UUID
  requested_by_name: string | null
  requested_at: string
  resolved_by: UUID | null
  resolved_by_name: string | null
  resolved_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface LicenseOffer {
  id: UUID
  license_request_id: UUID
  offer_number: number
  side: NegotiationSide
  proposed_by: UUID
  proposed_by_name: string | null
  license_fee: number | null
  currency: string | null
  territory: string | null
  media_rights: string | null
  license_start: string | null
  license_end: string | null
  exclusive: boolean
  notes: string | null
  created_at: string
}

// ─── Platform roles ───
export type PlatformRole = 'Admin' | 'Producer' | 'Artist' | 'Label Manager' | 'Viewer'

// ─── Paginated response ───
export interface Page {
  page: number
  page_size: number
  total: number
  pages: number
}

export interface Paginated<T> {
  items: T[]
  pagination: Page
}
