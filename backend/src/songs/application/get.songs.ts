import { Injectable } from '@nestjs/common';
import type { Song } from '../domain/song.interface';
import { PrismaSongRepository } from '../infrastructure/prisma.song.repository';

@Injectable()
export class GetSongs {
    constructor(private readonly song: PrismaSongRepository) {}
    async execute(): Promise<Song[] | null> {
        return this.song.findAll()
    }
}