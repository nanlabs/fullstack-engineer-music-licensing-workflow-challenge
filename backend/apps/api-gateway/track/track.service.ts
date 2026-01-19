import {
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ClientRMQ } from '@nestjs/microservices';
import { CreateTrackDto } from 'libs/shared/dto/create-track.dto';
import { LicensingStatus } from 'libs/shared';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class TrackService {
  constructor(
    @Inject(forwardRef(() => 'TRACK_SERVICE'))
    private readonly trackMicroserviceClient: ClientRMQ,
  ) {}

  async fetch() {
    const result = await lastValueFrom(
      this.trackMicroserviceClient.send('track.fetch.all', {}),
    );
    return result;
  }

  async fetchById(id: number) {
    const result = await lastValueFrom(
      this.trackMicroserviceClient.send('track.fetch.byId', { id }),
    );
    return result;
  }

  async create(createTrackPayload: CreateTrackDto) {
    const result = await lastValueFrom(
      this.trackMicroserviceClient.send('track.create.one', createTrackPayload),
    );
    return result;
  }

  async updateLicensingStatus(trackId: number, status: LicensingStatus) {
    const result = await lastValueFrom(
      this.trackMicroserviceClient.send('track.update.licensing', { trackId, status }),
    );
    return result;
  }
}
