import {
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ClientRMQ } from '@nestjs/microservices';
import { CreateTrackDto } from 'libs/shared/dto/create-track.dto';
import { LicensingStatus, INJECTION_TOKENS, TRACK_PATTERNS } from 'libs/shared';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class TrackService {
  constructor(
    @Inject(forwardRef(() => INJECTION_TOKENS.TRACK_SERVICE))
    private readonly trackMicroserviceClient: ClientRMQ,
  ) {}

  async fetch() {
    const result = await lastValueFrom(
      this.trackMicroserviceClient.send(TRACK_PATTERNS.FETCH_ALL, {}),
    );
    return result;
  }

  async fetchById(id: number) {
    const result = await lastValueFrom(
      this.trackMicroserviceClient.send(TRACK_PATTERNS.FETCH_BY_ID, { id }),
    );
    return result;
  }

  async create(createTrackPayload: CreateTrackDto) {
    const result = await lastValueFrom(
      this.trackMicroserviceClient.send(TRACK_PATTERNS.CREATE_ONE, createTrackPayload),
    );
    return result;
  }

  async updateLicensingStatus(trackId: number, status: LicensingStatus) {
    const result = await lastValueFrom(
      this.trackMicroserviceClient.send(TRACK_PATTERNS.UPDATE_LICENSING, { trackId, status }),
    );
    return result;
  }
}
