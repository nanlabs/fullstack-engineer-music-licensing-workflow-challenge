import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { TracksRepository } from './tracks.repository';
import { Prisma, LicensingStatus } from '@prisma/client';
import { CreateTrackDto } from './dto/track.dto';
import Redis from 'ioredis';

@Injectable()
export class TracksService {
  constructor(
    private readonly tracksRepository: TracksRepository,
    @Inject('REDIS_PUBLISHER') private readonly redisPublisher: Redis,
  ) {}

  create(createTrackDto: CreateTrackDto) {
    const { sceneId, songId, ...trackData } = createTrackDto;
    return this.tracksRepository.create({
      ...trackData,
      scene: { connect: { id: sceneId } },
      song: { connect: { id: songId } },
    });
  }

  findAll() {
    return this.tracksRepository.findAll();
  }

  findOne(id: string) {
    return this.tracksRepository.findOne(id);
  }

  async update(id: string, updateTrackDto: Prisma.TrackUpdateInput) {
    const track = await this.tracksRepository.findOne(id);
    if (!track) {
      throw new BadRequestException('Track not found');
    }

    // State Machine Logic
    if (updateTrackDto.status) {
      this.validateStatusTransition(track.status, updateTrackDto.status as LicensingStatus);
    }

    const updatedTrack = await this.tracksRepository.update(id, updateTrackDto);

    // Async notification via Redis
    if (updateTrackDto.status) {
      await this.redisPublisher.publish('track_updates', JSON.stringify({ trackId: id, status: updateTrackDto.status }));
    }

    return updatedTrack;
  }

  remove(id: string) {
    return this.tracksRepository.remove(id);
  }

  private validateStatusTransition(current: LicensingStatus, next: LicensingStatus) {
    const validTransitions: Record<LicensingStatus, LicensingStatus[]> = {
      [LicensingStatus.PENDING]: [LicensingStatus.NEGOTIATING, LicensingStatus.REJECTED],
      [LicensingStatus.NEGOTIATING]: [LicensingStatus.APPROVED, LicensingStatus.REJECTED],
      [LicensingStatus.APPROVED]: [], // Terminal state
      [LicensingStatus.REJECTED]: [LicensingStatus.PENDING], // Can restart? Let's say yes for now.
    };

    if (!validTransitions[current].includes(next)) {
      throw new BadRequestException(`Invalid status transition from ${current} to ${next}`);
    }
  }
}
