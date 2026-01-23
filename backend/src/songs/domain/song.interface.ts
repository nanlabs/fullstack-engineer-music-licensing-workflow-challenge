export interface Song {
    id: string;
    title: string;
    artist: string;
    label: string;
}

export interface SongRepository {
    findAll(): Promise<Song[]>;
    findOne(id: string): Promise<Song | null>;
    create(song: Omit<Song, 'id'>): Promise<Song>;
    update(id: string, song: Partial<Omit<Song, 'id'>>): Promise<Song | null>;
    remove(id: string): Promise<void>;
}