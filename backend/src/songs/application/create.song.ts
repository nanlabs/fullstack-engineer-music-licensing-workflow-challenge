import { Injectable } from '@nestjs/common';
import type { Song } from '../domain/song.interface';
import { PrismaSongRepository } from '../infrastructure/prisma.song.repository';

@Injectable()
export class CreateSong {
    constructor(private readonly song: PrismaSongRepository) {}

    async execute(data: Omit<Song, 'id'>): Promise<Song> {
        return this.song.create(data)
    }
}