import { LicensingState } from '../../entities/track.entity';

export type RealtimeEventType =
  | 'licensing_status_update'
  | 'track_created'
  | 'track_updated'
  | 'track_deleted';

export interface TrackData {
  id: string;
  sceneId: string;
  songId: string;
  startTime: number;
  endTime: number;
  currentLicensingStatus: LicensingState;
  scene?: {
    id: string;
    title: string;
    movieId: string;
  } | null;
  song?: {
    id: string;
    title: string;
    artist: string;
  } | null;
}

export interface LicensingStatusUpdateData {
  trackId: string;
  sceneId: string;
  songId: string;
  movieId: string | null;
  oldStatus: LicensingState;
  newStatus: LicensingState;
  notes?: string;
  updatedBy?: string;
  track: TrackData;
}

export interface TrackCreatedData {
  trackId: string;
  sceneId: string;
  songId: string;
  movieId: string | null;
  track: TrackData;
}

export interface TrackUpdatedData {
  trackId: string;
  sceneId: string;
  songId: string;
  movieId: string | null;
  track: TrackData;
}

export interface TrackDeletedData {
  trackId: string;
  sceneId: string;
  movieId?: string;
}

export type RealtimeEventData =
  | LicensingStatusUpdateData
  | TrackCreatedData
  | TrackUpdatedData
  | TrackDeletedData;

export interface RealtimeEvent {
  type: RealtimeEventType;
  data: RealtimeEventData;
  timestamp: string;
}
