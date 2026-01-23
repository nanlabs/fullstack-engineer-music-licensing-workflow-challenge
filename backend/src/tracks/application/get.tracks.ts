import { Injectable } from '@nestjs/common';
import { Track } from '../domain/track.interface';
import { PrismaTrackRepository } from '../infrastructure/prisma.track.repository';


@Injectable()
export class GetTracks {
    constructor(
        private readonly track: PrismaTrackRepository
    ) {}

    async execute(): Promise<Track[]> {
        return this.track.findAll()
    }
}