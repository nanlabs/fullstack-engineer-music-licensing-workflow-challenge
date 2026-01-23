import { Injectable, NotFoundException } from '@nestjs/common';
import type { Song } from '../domain/song.interface';
import { PrismaSongRepository } from '../infrastructure/prisma.song.repository';

@Injectable()
export class UpdateSong {
    constructor(private readonly song: PrismaSongRepository) {}

    async execute(id: string, data: Partial<Omit<Song, 'id'>>): Promise<Song | null> {
        const song = await this.song.findOne(id)

        if (!song) {
            throw new NotFoundException('Song not found')
        }

        return this.song.update(id, data)
    }
}