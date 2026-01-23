import { PrismaService } from '../../prisma/prisma.service';
import { Track, TrackRepository } from '../domain/track.interface';
import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateTrackStatus } from '../domain/track.interface';
import { LicensingStatus } from '@prisma/client';

@Injectable()
export class PrismaTrackRepository implements TrackRepository {

    constructor(private readonly prisma: PrismaService) {}

    async findAll(): Promise<Track[]> {
        return this.prisma.track.findMany();
    }

    async create(track: Omit<Track, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Track> {
        const { sceneId, songId, ...rest } = track;
        
        try {
            return await this.prisma.track.create({
                data: {
                    ...rest,
                    status: LicensingStatus.PENDING,
                    scene: { connect: { id: sceneId } },
                    song: { connect: { id: songId } },
                },
            })
        } catch (error) {
            if (error.code === 'P2025') {
                throw new NotFoundException('Scene or Song not found');
            }
            throw error;
        }
    }

    async findById(id: string): Promise<Track | null> {
        return this.prisma.track.findUnique({
            where: { id },
        })
    }

    async updateStatus(id: string, data: UpdateTrackStatus): Promise<Track | null> {
        return this.prisma.track.update({
            where: { id },
            data: {
                status: data.status,
            },
        })
    }
}