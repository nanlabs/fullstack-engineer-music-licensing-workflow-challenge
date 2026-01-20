import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TrackService } from './track.service';
import { LicensingStatus, TRACK_PATTERNS } from 'libs/shared';
import type { CreateTrackDto } from 'libs/shared/dto/create-track.dto';

@Controller()
export class TrackController {
  constructor(private readonly trackService: TrackService) {}

  @MessagePattern(TRACK_PATTERNS.FETCH_ALL)
  async fetchAllTracks() {
    return this.trackService.findAll();
  }

  @MessagePattern(TRACK_PATTERNS.FETCH_BY_ID)
  async fetchTrackById(@Payload() payload: { id: number }) {
    return this.trackService.findById(payload.id);
  }

  @MessagePattern(TRACK_PATTERNS.CREATE_ONE)
  async createOne(@Payload() createTrackPayload: CreateTrackDto) {
    return this.trackService.create(createTrackPayload);
  }

  @MessagePattern(TRACK_PATTERNS.UPDATE_LICENSING)
  async updateLicensingStatus(
    @Payload() payload: { trackId: number; status: LicensingStatus },
  ) {
    return this.trackService.updateLicensingStatus(payload.trackId, payload.status);
  }
}
