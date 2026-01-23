import type { Song } from "./song";

export type StatusType = "PENDING" | "NEGOTIATING" | "APPROVED" | "REJECTED";

export interface Track {
    id: string;
    status: StatusType;
    startInScene: number;
    endInScene: number;
    sceneId: string;
    songId: string;
    createdAt: string;
    updatedAt: string;
    song?: Song;
}