// The surface the UI programs against. Each domain is an interface; the
// real implementation (`./<domain>.ts`) satisfies it over the HTTP client, a
// fake can satisfy it in tests, and TypeScript guarantees the return types
// that the query layer (`@/lib/queries`) builds on.

import type {
  CreateInvitationRequest,
  CreateMovie,
  CreateRoleRequest,
  CreateScene,
  CreateSong,
  CreateTrack,
  CreatedInvitation,
  Id,
  InitiateLoginRequest,
  InitiateLoginResponse,
  InitiateSignupRequest,
  InitiateSignupResponse,
  Invitation,
  InvitationFilter,
  InvitationPreview,
  LicenseEvent,
  LicenseEventKind,
  ListOf,
  Me,
  MembershipsResponse,
  Movie,
  MovieFilter,
  PageQuery,
  Paginated,
  RefreshResponse,
  ResendOtpRequest,
  ResendOtpResponse,
  Role,
  RoleList,
  Scene,
  ScopesCatalog,
  SessionsResponse,
  Song,
  SongFilter,
  Tenant,
  TokenResponse,
  Track,
  TrackFilter,
  TransitionRequest,
  UpdateMovie,
  UpdateRoleRequest,
  UpdateScene,
  UpdateSong,
  UpdateTrack,
  User,
  UserRoles,
  VerifyLoginRequest,
  VerifySignupRequest,
  VerifySignupResponse,
} from "./types"

export interface AuthApi {
  memberships(email: string): Promise<MembershipsResponse>
  initiateLogin(body: InitiateLoginRequest): Promise<InitiateLoginResponse>
  /** Sets the access and refresh cookies on success. */
  verifyLogin(body: VerifyLoginRequest): Promise<TokenResponse>
  resendOtp(body: ResendOtpRequest): Promise<ResendOtpResponse>
  lookupInvitation(invitationToken: string): Promise<InvitationPreview>
  initiateSignup(body: InitiateSignupRequest): Promise<InitiateSignupResponse>
  verifySignup(body: VerifySignupRequest): Promise<VerifySignupResponse>
  /** Uses the refresh cookie; rotates both cookies. */
  refresh(): Promise<RefreshResponse>
  logout(): Promise<void>
  logoutAll(): Promise<void>
  me(): Promise<Me>
  sessions(): Promise<SessionsResponse>
}

export interface TenantsApi {
  me(): Promise<Tenant>
  scopes(): Promise<ScopesCatalog>
}

export interface UsersApi {
  list(query?: PageQuery): Promise<Paginated<User>>
  get(id: Id): Promise<User>
  suspend(id: Id): Promise<User>
  reinstate(id: Id): Promise<User>
  setScopes(id: Id, scopes: string[]): Promise<User>
  roles(id: Id): Promise<UserRoles>
}

export interface RolesApi {
  list(): Promise<RoleList>
  get(id: Id): Promise<Role>
  create(body: CreateRoleRequest): Promise<Role>
  update(id: Id, body: UpdateRoleRequest): Promise<Role>
  remove(id: Id): Promise<void>
  assign(roleId: Id, userId: Id): Promise<void>
  unassign(roleId: Id, userId: Id): Promise<void>
}

export interface InvitationsApi {
  list(filter?: InvitationFilter): Promise<Paginated<Invitation>>
  get(id: Id): Promise<Invitation>
  create(body: CreateInvitationRequest): Promise<CreatedInvitation>
  resend(id: Id): Promise<CreatedInvitation>
  revoke(id: Id): Promise<Invitation>
}

export interface MoviesApi {
  list(filter?: MovieFilter): Promise<Paginated<Movie>>
  get(id: Id): Promise<Movie>
  create(body: CreateMovie): Promise<Movie>
  update(id: Id, body: UpdateMovie): Promise<Movie>
  remove(id: Id): Promise<void>
}

export interface ScenesApi {
  byMovie(movieId: Id): Promise<ListOf<Scene>>
  get(id: Id): Promise<Scene>
  create(movieId: Id, body: CreateScene): Promise<Scene>
  update(id: Id, body: UpdateScene): Promise<Scene>
  remove(id: Id): Promise<void>
  /** Every scene of the movie exactly once; returns them renumbered. */
  reorder(movieId: Id, sceneIds: Id[]): Promise<ListOf<Scene>>
}

export interface TracksApi {
  byScene(sceneId: Id, filter?: TrackFilter): Promise<ListOf<Track>>
  byMovie(movieId: Id, filter?: TrackFilter): Promise<ListOf<Track>>
  get(id: Id): Promise<Track>
  create(sceneId: Id, body: CreateTrack): Promise<Track>
  update(id: Id, body: UpdateTrack): Promise<Track>
  remove(id: Id): Promise<void>
}

export interface LicensesApi {
  transition(
    trackId: Id,
    event: LicenseEventKind,
    body?: TransitionRequest
  ): Promise<Track>
  history(trackId: Id): Promise<ListOf<LicenseEvent>>
}

export interface SongsApi {
  list(filter?: SongFilter): Promise<Paginated<Song>>
  get(id: Id): Promise<Song>
  create(body: CreateSong): Promise<Song>
  update(id: Id, body: UpdateSong): Promise<Song>
  remove(id: Id): Promise<void>
}

export interface Api {
  auth: AuthApi
  tenants: TenantsApi
  users: UsersApi
  roles: RolesApi
  invitations: InvitationsApi
  movies: MoviesApi
  scenes: ScenesApi
  tracks: TracksApi
  licenses: LicensesApi
  songs: SongsApi
}
