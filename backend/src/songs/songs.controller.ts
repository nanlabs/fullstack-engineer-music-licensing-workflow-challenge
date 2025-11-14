import { Body, Post, Get, Param } from '@nestjs/common';
import { CreateSongDto } from './dto/create-song.dto';
import { SongsService } from './songs.service';
import { ApiController } from 'src/shared/decorators';
import { SongIdDto } from './dto/song-id.dto';

@ApiController('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Post()
  async create(@Body() createSongDto: CreateSongDto) {
    return await this.songsService.create(createSongDto);
  }

  @Get()
  async findAll() {
    return await this.songsService.findAll();
  }

  @Get(':songId')
  async findOne(@Param() songIdDto: SongIdDto) {
    return await this.songsService.findOne(songIdDto);
  }
}
