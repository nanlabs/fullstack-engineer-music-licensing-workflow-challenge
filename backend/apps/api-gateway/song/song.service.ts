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
import { catchError, lastValueFrom, timeout } from 'rxjs';

@Injectable()
export class SongService {
  constructor(
    @Inject(forwardRef(() => 'SONG_SERVICE'))
    private readonly songMicroserviceClient: ClientRMQ,
  ) {}

  getHello(): string {
    return 'Hello World FROM API API Gateway!';
  }

  async fetch() {
    const result = await lastValueFrom(
      this.songMicroserviceClient.send('song.fetch.all', {}),
    );
    return result;
  }

  async create(createSongPayload: CreateSongDto) {
    const result = await lastValueFrom(
      this.songMicroserviceClient.send('song.create.one', createSongPayload),
    );
    return result;
  }
}
