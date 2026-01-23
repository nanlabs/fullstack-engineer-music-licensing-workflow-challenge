import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaSongRepository } from '../infrastructure/prisma.song.repository';

@Injectable()
export class RemoveSong {
    constructor(private readonly song: PrismaSongRepository) {}

    async execute(id: string): Promise<void> {
        const song = await this.song.findOne(id)
        
        if (!song) {
            throw new NotFoundException('Song not found')
        }
                
        return this.song.remove(id)
    }
}