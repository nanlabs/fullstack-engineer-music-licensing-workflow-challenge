import { Injectable } from '@nestjs/common';
import { Track, CreateTrackData } from '../domain/track.interface';
import { PrismaTrackRepository } from '../infrastructure/prisma.track.repository';


@Injectable()
export class CreateTrack {
    constructor(
        private readonly track: PrismaTrackRepository
    ) {}

    async execute(data: CreateTrackData): Promise<Track> {
        return this.track.create(data)
    }

}