import { Module } from '@nestjs/common';
import { TracksController } from './controllers/tracks.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTrackRepository } from './infrastructure/prisma.track.repository';
import { UpdateTrackLicensingStatus } from './application/update.track.licensing.status';
import { CreateTrack } from './application/create.track';
import { GetTracks } from './application/get.tracks';
import { LicensingRepository } from './infrastructure/licensing.repository';
import { TrackLicensingGateway } from './infrastructure/web/track.licensing.gateway';

@Module({
  imports: [],
  controllers: [TracksController],
  providers: [
    PrismaService,
    PrismaTrackRepository,
    LicensingRepository,
    UpdateTrackLicensingStatus,
    CreateTrack,
    GetTracks,
    TrackLicensingGateway,
  ],
})
export class TracksModule {}
