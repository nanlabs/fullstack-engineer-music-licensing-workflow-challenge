import { Controller, forwardRef, Get, Inject } from '@nestjs/common';
import { SongService } from './song.service';
import { TypeOrmRepositoryService } from 'libs/database/postgres/repository/service/typeorm-repository.service';
import {
  ClientRMQ,
  ClientTCP,
  EventPattern,
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import { SongEntity } from '@app/shared/SongEntity';
import { CreateSongDto } from 'libs/shared/dto/create-song.dto';

@Controller()
export class SongController {
  constructor(
    @Inject(forwardRef(() => 'SONG_SERVICE'))
    private readonly songServiceClient: ClientRMQ,
    private typeOrmRepositoryService: TypeOrmRepositoryService,
    private readonly songService: SongService,
  ) {}

  @Get()
  getHello(): string {
    return this.songService.getHello();
  }

  @MessagePattern('song.fetch.all')
  async fetchAllSongs() {
    return this.typeOrmRepositoryService.songRepository.findAll();
  }

  @MessagePattern('song.fetch.byId')
  async fetchSongById(@Payload() payload: { id: number }) {
    return this.typeOrmRepositoryService.songRepository.findById(payload.id);
  }

  @MessagePattern('song.create.one')
  async createOne(createSongPayload: CreateSongDto) {
    const newSong = new SongEntity();
    newSong.releaseDate = createSongPayload.releaseDate;
    newSong.title = createSongPayload.title;
    newSong.seconds = createSongPayload.seconds;

    return this.typeOrmRepositoryService.songRepository.createOne(newSong);
  }
}
