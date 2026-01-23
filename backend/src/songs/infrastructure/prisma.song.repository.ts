import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Song, SongRepository } from '../domain/song.interface';

@Injectable()
export class PrismaSongRepository implements SongRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(song: Omit<Song, 'id'>): Promise<Song> {
        return this.prisma.song.create({
            data: song,
        })
    }

    async findAll(): Promise<Song[]> {
        return this.prisma.song.findMany()
    }

    async findOne(id: string): Promise<Song | null> {
        return this.prisma.song.findUnique({
            where: { id },
        })
    }

    async update(id: string, song: Partial<Omit<Song, 'id'>>): Promise<Song | null> {
        return this.prisma.song.update({
            where: { id },
            data: song
        })
    }

    async remove(id: string): Promise<void> {
        await this.prisma.song.delete({
            where: { id },
        })
    }
}