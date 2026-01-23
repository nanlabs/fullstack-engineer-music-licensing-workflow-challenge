import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Track } from '../domain/track.interface';
import { LicensingRepository } from '../infrastructure/licensing.repository';
import { LicensingStatus } from '@prisma/client';
import { TrackLicensingGateway } from '../infrastructure/web/track.licensing.gateway';

@Injectable()
export class UpdateTrackLicensingStatus {
    constructor(
        private readonly prisma: PrismaService,
        private readonly licensing: LicensingRepository,
        private readonly gateway: TrackLicensingGateway
    ) {}

    async execute(id: string, status: LicensingStatus): Promise<Track | null> {
        const track = await this.prisma.track.findUnique({ where: { id } })
        if (!track) {
            throw new NotFoundException('Track not found')
        }

        if (!this.licensing.canTransition(track.status, status)) {
            throw new BadRequestException(`Invalid status transition from ${track.status} to ${status}`)
        }

        const updated = await this.prisma.track.update({
            where: { id },
            data: { status },
        })

        this.gateway.sendUpdate(id, status)

        return updated
    }
}