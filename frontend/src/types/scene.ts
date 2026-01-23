import type { Track } from "./track";

export interface Scene {
    id: string;
    description: string;
    movieId: string;
    startTime: number;
    tracks: Track[];
}