// Contract every resource client (real HTTP or mock) must satisfy.
// Mirrors backend/src/*/api.rs route tables 1:1.

import type {
  AddMemberRequest,
  AddMovieMemberRequest,
  CreateLabelRequest,
  CreateLicenseRequest,
  CreateMovieRequest,
  CreateSceneRequest,
  CreateSongRequest,
  CreateTrackRequest,
  FindMoviesQuery,
  FindSongsQuery,
  Label,
  LabelMember,
  LicenseEvent,
  LicenseOffer,
  LicenseRequest,
  LoginBody,
  MeResponse,
  Movie,
  MovieMember,
  OfferTerms,
  Paginated,
  Scene,
  SessionResponse,
  Song,
  TokenResponse,
  Track,
  UpdateLabelRequest,
  UpdateMovieRequest,
  UpdateSceneRequest,
  UpdateSongRequest,
  UpdateTrackRequest,
} from '@/types'

export interface MoviesApi {
  create(body: CreateMovieRequest): Promise<Movie>
  find(query: FindMoviesQuery): Promise<Paginated<Movie>>
  get(id: string): Promise<Movie>
  update(id: string, body: UpdateMovieRequest): Promise<Movie>
  delete(id: string): Promise<void>
  myMovies(): Promise<Movie[]>
  addMember(id: string, body: AddMovieMemberRequest): Promise<MovieMember>
  removeMember(id: string, userId: string): Promise<void>
  listMembers(id: string): Promise<MovieMember[]>
  listScenes(id: string): Promise<Scene[]>
}

export interface ScenesApi {
  create(body: CreateSceneRequest): Promise<Scene>
  get(id: string): Promise<Scene>
  update(id: string, body: UpdateSceneRequest): Promise<Scene>
  delete(id: string): Promise<void>
  listTracks(id: string): Promise<Track[]>
}

export interface SongsApi {
  create(body: CreateSongRequest): Promise<Song>
  find(query: FindSongsQuery): Promise<Paginated<Song>>
  get(id: string): Promise<Song>
  update(id: string, body: UpdateSongRequest): Promise<Song>
  delete(id: string): Promise<void>
  listByArtist(artistId: string): Promise<Song[]>
  listTracks(id: string): Promise<Track[]>
}

export interface TracksApi {
  create(body: CreateTrackRequest): Promise<Track>
  get(id: string): Promise<Track>
  update(id: string, body: UpdateTrackRequest): Promise<Track>
  delete(id: string): Promise<void>
  getLicense(id: string): Promise<LicenseRequest | null>
}

export interface LabelsApi {
  create(body: CreateLabelRequest): Promise<Label>
  list(): Promise<Label[]>
  get(id: string): Promise<Label>
  update(id: string, body: UpdateLabelRequest): Promise<Label>
  delete(id: string): Promise<void>
  addMember(id: string, body: AddMemberRequest): Promise<LabelMember>
  removeMember(id: string, userId: string): Promise<void>
  listMembers(id: string): Promise<LabelMember[]>
  getUserLabels(userId: string): Promise<Label[]>
  listSongs(id: string): Promise<Song[]>
}

export interface LicensesApi {
  create(body: CreateLicenseRequest): Promise<{ license: LicenseRequest; offer: LicenseOffer }>
  get(id: string): Promise<LicenseRequest>
  listOffers(id: string): Promise<LicenseOffer[]>
  reviseDraft(id: string, body: OfferTerms): Promise<LicenseOffer>
  submit(id: string): Promise<LicenseRequest>
  counterOffer(id: string, body: OfferTerms): Promise<LicenseOffer>
  accept(id: string): Promise<LicenseRequest>
  reject(id: string, reason: string): Promise<LicenseRequest>
  cancel(id: string): Promise<LicenseRequest>
  delete(id: string): Promise<void>
  /** Subscribe to the SSE negotiation event stream. Returns an unsubscribe fn. */
  subscribeEvents(onEvent: (event: LicenseEvent) => void): () => void
}

export interface AuthApi {
  login(body: LoginBody): Promise<TokenResponse>
  refresh(refreshToken: string): Promise<TokenResponse>
  logout(refreshToken: string): Promise<void>
  logoutAll(): Promise<void>
  me(): Promise<MeResponse>
  listSessions(): Promise<SessionResponse[]>
  revokeSession(id: string): Promise<void>
}

export interface Api {
  auth: AuthApi
  movies: MoviesApi
  scenes: ScenesApi
  songs: SongsApi
  tracks: TracksApi
  labels: LabelsApi
  licenses: LicensesApi
}
