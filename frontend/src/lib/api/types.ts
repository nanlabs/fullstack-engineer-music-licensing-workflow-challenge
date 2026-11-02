// Wire types of the backend (`/api/v1`), written from the Rust structs they
// serialize. `Option<T>` is always present as `T | null`; enums are snake_case
// strings; ids are UUIDs; dates are RFC 3339 strings in UTC.

export type Id = string
export type IsoDate = string

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface Pagination {
  page: number
  page_size: number
  total: number
  pages: number
}

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
  empty: boolean
}

export interface ListOf<T> {
  items: T[]
  count: number
}

export interface PageQuery {
  page?: number
  page_size?: number
}

export type ErrorKind =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS"
  | "RATE_LIMITED"
  | "EXTERNAL"
  | "INTERNAL"

export interface ApiErrorBody {
  error: {
    code: string
    kind: ErrorKind
    message: string
    details?: Record<string, unknown>
  }
}

/** One entry of `details.fields[<field>]` on a 400 from the validator. */
export interface FieldViolation {
  code: string
  message: string | null
  params: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// IAM
// ---------------------------------------------------------------------------

export const USER_STATUSES = ["pending", "active", "suspended"] as const
export type UserStatus = (typeof USER_STATUSES)[number]
export type TenantStatus = "active" | "suspended"
export const INVITATION_STATUSES = [
  "pending",
  "accepted",
  "revoked",
  "expired",
] as const
export type InvitationStatus = (typeof INVITATION_STATUSES)[number]
export type OtpPurpose = "signup" | "login"

export interface Tenant {
  id: Id
  slug: string
  name: string
  status: TenantStatus
  created_at: IsoDate
}

export interface User {
  id: Id
  tenant_id: Id
  email: string
  name: string
  status: UserStatus
  /** Direct grants only; roles are resolved separately. */
  scopes: string[]
  email_verified: boolean
  otp_enabled: boolean
  last_login_at: IsoDate | null
  created_at: IsoDate
}

export interface Role {
  id: Id
  tenant_id: Id
  name: string
  description: string
  scopes: string[]
  created_at: IsoDate
  updated_at: IsoDate
}

export interface RoleList {
  roles: Role[]
  count: number
}

export interface UserRoles {
  user_id: Id
  roles: Role[]
  direct_scopes: string[]
  effective_scopes: string[]
}

export interface ScopeDescription {
  scope: string
  description: string
}

export interface ScopesCatalog {
  scopes: ScopeDescription[]
  wildcard: "*"
}

export interface MembershipOption {
  tenant_id: Id
  tenant_slug: string
  tenant_name: string
  user_status: UserStatus
  auth_methods: { otp: boolean }
}

export interface MembershipsResponse {
  email: string
  tenants: MembershipOption[]
  count: number
}

export interface InitiateLoginRequest {
  email: string
  tenant_id: Id
}

export interface InitiateLoginResponse {
  message: string
  email: string
  expires_in_seconds: number
}

export interface VerifyLoginRequest {
  email: string
  tenant_id: Id
  code: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: "Bearer"
  /** Seconds until the access token (and its cookie) expire. */
  expires_in: number
  user: User
  tenant: Tenant
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
  token_type: "Bearer"
  expires_in: number
}

export interface ResendOtpRequest {
  email: string
  tenant_id: Id
  purpose: OtpPurpose
  invitation_token?: string
}

export interface ResendOtpResponse {
  message: string
  expires_in_seconds: number
}

export interface Me {
  user: User
  tenant: Tenant
  /** Direct grants plus role grants, read live from the database. */
  effective_scopes: string[]
  session_id: Id | null
}

export interface Session {
  id: Id
  ip_address: string
  user_agent: string
  created_at: IsoDate
  last_activity_at: IsoDate
  expires_at: IsoDate
  current: boolean
}

export interface SessionsResponse {
  sessions: Session[]
  count: number
}

export interface InvitationPreview {
  email: string
  tenant_id: Id
  tenant_name: string
  invited_by_name: string
  expires_at: IsoDate
}

export interface InitiateSignupRequest {
  email: string
  name: string
  invitation_token: string
}

export interface InitiateSignupResponse {
  message: string
  email: string
  tenant_id: Id
  requires_otp: boolean
  expires_in_seconds: number
}

export interface VerifySignupRequest extends InitiateSignupRequest {
  tenant_id: Id
  code: string
}

export interface VerifySignupResponse {
  message: string
  tenant_id: Id
  email: string
  user_id: Id
}

export interface Invitation {
  id: Id
  tenant_id: Id
  email: string
  scopes: string[]
  role_id: Id | null
  invited_by: Id
  /** Expired invitations may still read `pending`; compare `expires_at`. */
  status: InvitationStatus
  expires_at: IsoDate
  accepted_at: IsoDate | null
  created_at: IsoDate
}

export interface CreatedInvitation extends Invitation {
  delivered: boolean
}

export interface InvitationFilter extends PageQuery {
  status?: InvitationStatus
}

export interface CreateInvitationRequest {
  email: string
  scopes?: string[]
  role_id?: Id | null
}

export interface CreateRoleRequest {
  name: string
  description?: string
  scopes?: string[]
}

export interface UpdateRoleRequest {
  name?: string
  description?: string
  scopes?: string[]
}

// ---------------------------------------------------------------------------
// Licensing
// ---------------------------------------------------------------------------

export const MOVIE_STATUSES = [
  "draft",
  "in_production",
  "released",
  "archived",
] as const
export type MovieStatus = (typeof MOVIE_STATUSES)[number]

export const RIGHTS_HOLDER_KINDS = ["artist", "label", "publisher"] as const
export type RightsHolderKind = (typeof RIGHTS_HOLDER_KINDS)[number]

export const TRACK_USAGES = ["background", "featured"] as const
export type TrackUsage = (typeof TRACK_USAGES)[number]

export const LICENSE_STATES = [
  "pending",
  "requested",
  "negotiating",
  "approved",
  "rejected",
  "expired",
] as const
export type LicenseState = (typeof LICENSE_STATES)[number]

/** States in which the cue is frozen and the scene or movie cannot be deleted. */
export const ACTIVE_LICENSE_STATES: readonly LicenseState[] = [
  "requested",
  "negotiating",
  "approved",
]

export const LICENSE_EVENTS = [
  "request",
  "start_negotiation",
  "approve",
  "reject",
  "reopen",
  "expire",
] as const
export type LicenseEventKind = (typeof LICENSE_EVENTS)[number]

export type LicenseEventSource = "acme" | "rights_holder" | "system"

export interface Movie {
  id: Id
  tenant_id: Id
  title: string
  synopsis: string | null
  release_year: number | null
  status: MovieStatus
  created_at: IsoDate
  updated_at: IsoDate
}

export interface MovieFilter extends PageQuery {
  q?: string
  status?: MovieStatus
}

export interface CreateMovie {
  title: string
  synopsis?: string
  release_year?: number
  status?: MovieStatus
}

/** Absent keeps the value; `synopsis: ""` clears it. `release_year` cannot be cleared. */
export interface UpdateMovie {
  title?: string
  synopsis?: string
  release_year?: number
  status?: MovieStatus
}

export interface Scene {
  id: Id
  tenant_id: Id
  movie_id: Id
  /** 1-based; gaps are possible after a delete until the next reorder. */
  position: number
  title: string
  description: string | null
  /** Milliseconds on the movie timeline; both bounds or neither. */
  start_ms: number | null
  end_ms: number | null
  created_at: IsoDate
  updated_at: IsoDate
}

export interface CreateScene {
  title: string
  description?: string
  start_ms?: number
  end_ms?: number
}

/** `start_ms: null` / `end_ms: null` clear the window; absent keeps it. */
export interface UpdateScene {
  title?: string
  description?: string
  start_ms?: number | null
  end_ms?: number | null
}

export interface Song {
  id: Id
  tenant_id: Id
  title: string
  artist: string
  album: string | null
  release_year: number | null
  duration_ms: number | null
  isrc: string | null
  iswc: string | null
  rights_holder: string
  rights_holder_kind: RightsHolderKind | null
  rights_holder_email: string | null
  notes: string | null
  created_at: IsoDate
  updated_at: IsoDate
}

export interface SongFilter extends PageQuery {
  /** Case-insensitive substring of title or artist. */
  q?: string
}

export interface CreateSong {
  title: string
  artist: string
  rights_holder: string
  album?: string
  release_year?: number
  duration_ms?: number
  isrc?: string
  iswc?: string
  rights_holder_kind?: RightsHolderKind
  rights_holder_email?: string
  notes?: string
}

/** `""` clears the text fields; `null` clears year, duration and kind. */
export interface UpdateSong {
  title?: string
  artist?: string
  rights_holder?: string
  album?: string
  release_year?: number | null
  duration_ms?: number | null
  isrc?: string
  iswc?: string
  rights_holder_kind?: RightsHolderKind | null
  rights_holder_email?: string
  notes?: string
}

export interface SongSummary {
  id: Id
  title: string
  artist: string
  rights_holder: string
}

export interface LicenseSummary {
  state: LicenseState
  updated_at: IsoDate
  expires_at: IsoDate | null
  /** What the state machine allows next, regardless of the caller's scopes. */
  allowed_events: LicenseEventKind[]
}

export interface Track {
  id: Id
  tenant_id: Id
  movie_id: Id
  scene_id: Id
  song: SongSummary
  /** Milliseconds on the movie timeline. */
  start_ms: number
  end_ms: number
  duration_ms: number
  usage: TrackUsage
  created_at: IsoDate
  updated_at: IsoDate
  license: LicenseSummary
}

export interface TrackFilter {
  state?: LicenseState
}

export interface CreateTrack {
  song_id: Id
  start_ms: number
  end_ms: number
  usage: TrackUsage
}

export interface UpdateTrack {
  song_id?: Id
  start_ms?: number
  end_ms?: number
  usage?: TrackUsage
}

export interface TransitionRequest {
  note?: string
  source?: Exclude<LicenseEventSource, "system">
  /** Only with `approve`; must be in the future. */
  expires_at?: IsoDate
  /** Optimistic guard: 409 LICENSE_STATE_STALE when it no longer matches. */
  expected_state?: LicenseState
}

export interface LicenseActor {
  user_id: Id | null
  name: string | null
}

export interface LicenseEvent {
  id: Id
  /** 1..n within the license. */
  seq: number
  event: LicenseEventKind
  from_state: LicenseState
  to_state: LicenseState
  source: LicenseEventSource
  /** `null` for the expiry sweep. */
  actor: LicenseActor | null
  note: string | null
  created_at: IsoDate
}

/** Payload of the `license.changed` SSE event; `position` is the SSE id. */
export interface LicenseChanged {
  position: number
  tenant_id: Id
  event: LicenseEventKind
  from_state: LicenseState
  to_state: LicenseState
  source: LicenseEventSource
  seq: number
  occurred_at: IsoDate
  /** The track as it reads now (joined at read time on replay). */
  track: Track
}

export interface ResyncNotice {
  reason: string
}
