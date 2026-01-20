export enum LicensingStatus {
  LICENSED = "LICENSED",
  IN_NEGOTIATION = "IN_NEGOTIATION",
  UNLICENSED = "UNLICENSED",
}

export interface Licensing {
  id: number;
  status: LicensingStatus;
  created_at: string;
  updated_at: string;
}

export interface Song {
  id: number;
  title: string;
  releaseDate: number;
  seconds: number;
  created_at?: string;
  updated_at?: string;
}

export interface Movie {
  id: number;
  title: string;
  releaseDate: number;
  encodingFormat: string;
  created_at?: string;
  updated_at?: string;
}

export interface MovieScene {
  id: number;
  name: string;
  movie?: Movie;
  created_at?: string;
  updated_at?: string;
}

export interface Track {
  id: number;
  startTime: number;
  endTime: number;
  song?: Song;
  movieScene?: MovieScene;
  licensing?: Licensing;
  created_at?: string;
  updated_at?: string;
}

export interface CreateTrackDto {
  songId: number;
  movieSceneId: number;
  startTime: number;
  endTime: number;
}

export interface CreateSongDto {
  title: string;
  releaseDate: number;
  seconds: number;
}

export interface CreateMovieDto {
  title: string;
  releaseDate: number;
  encodingFormat: string;
}

export interface CreateMovieSceneDto {
  name: string;
  movieId: number;
}

export interface LicensingStatusUpdate {
  trackId: number;
  previousStatus: string;
  newStatus: string;
  updatedAt: string;
}

export interface TrackCreatedEvent {
  trackId: number;
  songId: number;
  movieSceneId: number;
  licensingStatus: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "licensing-status" | "track-created";
  message: string;
  details: string;
  timestamp: Date;
}
