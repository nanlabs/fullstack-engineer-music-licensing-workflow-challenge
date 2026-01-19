import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TrackService } from './track.service';
import { LicensingStatus } from 'libs/shared';
import type { CreateTrackDto } from 'libs/shared/dto/create-track.dto';

@Controller()
export class TrackController {
  constructor(private readonly trackService: TrackService) {}

  @MessagePattern('track.fetch.all')
  async fetchAllTracks() {
    return this.trackService.findAll();
  }

  @MessagePattern('track.fetch.byId')
  async fetchTrackById(@Payload() payload: { id: number }) {
    return this.trackService.findById(payload.id);
  }

  @MessagePattern('track.create.one')
  async createOne(@Payload() createTrackPayload: CreateTrackDto) {
    return this.trackService.create(createTrackPayload);
  }

  @MessagePattern('track.update.licensing')
  async updateLicensingStatus(
    @Payload() payload: { trackId: number; status: LicensingStatus },
  ) {
    return this.trackService.updateLicensingStatus(payload.trackId, payload.status);
  }
}
