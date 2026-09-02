// Request/response DTOs mirroring backend `api.rs` / `model.rs` structs.
// Keep in sync with backend/src/*/{model,api}.rs

import type { LabelRole, MovieRole, UsageType } from './domain'

// ─── Errors ───
export type ErrorType =
  | 'INTERNAL'
  | 'VALIDATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS'
  | 'EXTERNAL'

export interface ErrorResponse {
  code: string
  message: string
  error_type: ErrorType
  details?: Record<string, unknown>
}

// ─── Movies ───
export interface CreateMovieRequest {
  title: string
  description?: string | null
  release_year?: number | null
  director?: string | null
}

export interface UpdateMovieRequest {
  title?: string | null
  description?: string | null
  release_year?: number | null
  director?: string | null
}

export interface AddMovieMemberRequest {
  user_id: string
  role?: MovieRole | null
}

export interface FindMoviesQuery {
  page?: number
  page_size?: number
  search?: string
  created_by?: string
}

// ─── Scenes ───
export interface CreateSceneRequest {
  movie_id: string
  title: string
  scene_number: number
  description?: string | null
  start_time: number
  end_time: number
}

export interface UpdateSceneRequest {
  title?: string | null
  scene_number?: number | null
  description?: string | null
  start_time?: number | null
  end_time?: number | null
}

// ─── Songs ───
export interface CreateSongRequest {
  title: string
  artist_id: string
  label_id?: string | null
  album?: string | null
  duration_seconds: number
  genre?: string | null
  isrc?: string | null
}

export interface UpdateSongRequest {
  title?: string | null
  album?: string | null
  genre?: string | null
  isrc?: string | null
  duration_seconds?: number | null
}

export interface FindSongsQuery {
  page?: number
  page_size?: number
  search?: string
  artist_id?: string
  label_id?: string
  genre?: string
}

// ─── Tracks ───
export interface CreateTrackRequest {
  scene_id: string
  song_id: string
  usage_type: UsageType
  start_time_seconds: number
  end_time_seconds: number
  notes?: string | null
}

export interface UpdateTrackRequest {
  usage_type?: UsageType | null
  start_time_seconds?: number | null
  end_time_seconds?: number | null
  notes?: string | null
}

// ─── Labels ───
export interface CreateLabelRequest {
  name: string
  website?: string | null
  contact_email?: string | null
}

export interface UpdateLabelRequest {
  name?: string | null
  website?: string | null
  contact_email?: string | null
}

export interface AddMemberRequest {
  user_id: string
  role?: LabelRole | null
}

// ─── Licenses ───
export interface OfferTerms {
  license_fee?: number | null
  currency?: string | null
  territory?: string | null
  media_rights?: string | null
  license_start?: string | null
  license_end?: string | null
  exclusive?: boolean | null
  notes?: string | null
}

export interface CreateLicenseRequest extends OfferTerms {
  track_id: string
}

export interface RejectBody {
  reason: string
}

export interface LicenseEvent {
  license_id: string
  track_id: string
  kind: 'submitted' | 'counter_offer' | 'accepted' | 'rejected' | 'cancelled'
  actor: string
  actor_name: string
  timestamp: string
}

// ─── Auth ───
export interface LoginBody {
  email: string
  password: string
}

export interface RefreshBody {
  refresh_token: string
}

export interface LogoutBody {
  refresh_token: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface MeResponse {
  user_id: string
  email: string
  name: string
  scopes: string[]
}

export interface SessionResponse {
  id: string
  ip_address: string
  user_agent: string
  created_at: string
  last_activity: string
  expires_at: string
}

export interface MessageResponse {
  message: string
}
