import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SongService } from './song.service';
import { CreateSongDto } from 'libs/shared/dto/create-song.dto';

@Controller()
export class SongController {
  constructor(private readonly songService: SongService) {}

  @MessagePattern('song.fetch.all')
  async fetchAllSongs() {
    return this.songService.findAll();
  }

  @MessagePattern('song.fetch.byId')
  async fetchSongById(@Payload() payload: { id: number }) {
    return this.songService.findById(payload.id);
  }

  @MessagePattern('song.create.one')
  async createOne(@Payload() createSongPayload: CreateSongDto) {
    return this.songService.create(createSongPayload);
  }
}
