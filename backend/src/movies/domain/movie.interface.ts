import { Scene } from '../../scenes/domain/scene.interface';

export interface Movie {
    id: string;
    title: string;
    releaseDate: Date;
    scenes?: Scene[];
}

export interface MovieRepository {
    create(movie: Omit<Movie, 'id' | 'scenes'>): Promise<Movie>;
    findAll(): Promise<Movie[]>;
    findOne(id: string): Promise<Movie | null>;
    update(id: string, movie: Partial<Omit<Movie, 'id' | 'scenes'>>): Promise<Movie | null>;
    remove(id: string): Promise<void>;
}