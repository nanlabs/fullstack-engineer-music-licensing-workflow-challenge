import { Track } from '../../tracks/domain/track.interface';

export interface Scene {
    id: string;
    description: string;
    movieId: string;
    startTime: number;
    tracks?: Track[];
}

export interface SceneRepository {
    findById(id: string): Promise<Track[] | null>;
    create(scene: Omit<Scene, 'id' | 'tracks'>): Promise<Scene>;
}