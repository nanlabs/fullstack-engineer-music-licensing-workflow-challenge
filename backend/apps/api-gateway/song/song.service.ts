import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ClientRMQ, ClientTCP } from '@nestjs/microservices';
import { CreateMovieDto } from 'libs/shared/dto/create-movie.dto';
import { CreateSongDto } from 'libs/shared/dto/create-song.dto';
import { INJECTION_TOKENS, SONG_PATTERNS } from 'libs/shared';
import { catchError, lastValueFrom, timeout } from 'rxjs';

@Injectable()
export class SongService {
  constructor(
    @Inject(forwardRef(() => INJECTION_TOKENS.SONG_SERVICE))
    private readonly songMicroserviceClient: ClientRMQ,
  ) {}

  getHello(): string {
    return 'Hello World FROM API API Gateway!';
  }

  async fetch() {
    const result = await lastValueFrom(
      this.songMicroserviceClient.send(SONG_PATTERNS.FETCH_ALL, {}),
    );
    return result;
  }

  async create(createSongPayload: CreateSongDto) {
    const result = await lastValueFrom(
      this.songMicroserviceClient.send(SONG_PATTERNS.CREATE_ONE, createSongPayload),
    );
    return result;
  }
}
