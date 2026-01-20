import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SongService } from './song.service';
import { CreateSongDto } from 'libs/shared/dto/create-song.dto';
import { SONG_PATTERNS } from 'libs/shared';

@Controller()
export class SongController {
  constructor(private readonly songService: SongService) {}

  @MessagePattern(SONG_PATTERNS.FETCH_ALL)
  async fetchAllSongs() {
    return this.songService.findAll();
  }

  @MessagePattern(SONG_PATTERNS.FETCH_BY_ID)
  async fetchSongById(@Payload() payload: { id: number }) {
    return this.songService.findById(payload.id);
  }

  @MessagePattern(SONG_PATTERNS.CREATE_ONE)
  async createOne(@Payload() createSongPayload: CreateSongDto) {
    return this.songService.create(createSongPayload);
  }
}
