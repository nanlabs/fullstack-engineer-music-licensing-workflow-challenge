import { Injectable } from '@nestjs/common';
import type { Song } from '../domain/song.interface';
import { PrismaSongRepository } from '../infrastructure/prisma.song.repository';

@Injectable()
export class GetSong {
    constructor(private readonly song: PrismaSongRepository) {}

    async execute(id: string): Promise<Song | null> {
        return this.song.findOne(id)
    }
}