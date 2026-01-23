import { LicensingStatus } from "@prisma/client";

export interface Track {
    id: string;
    sceneId: string;
    songId: string;
    status: LicensingStatus;
    startInScene: number;
    endInScene: number;
    createdAt: Date;
    updatedAt: Date;
}

export type CreateTrackData = Omit<Track, 'id' | 'status' | 'createdAt' | 'updatedAt'>;
export type UpdateTrackStatus = Pick<Track, 'status'>

export interface TrackRepository {
    findAll(): Promise<Track[]>;
    findById(id: string): Promise<Track | null>;
    updateStatus(id: string, status: UpdateTrackStatus): Promise<Track | null>;
}

