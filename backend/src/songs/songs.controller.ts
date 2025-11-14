import { Body, Post, Get, Param } from '@nestjs/common';
import { CreateSongDto } from './dto/create-song.dto';
import { SongsService } from './songs.service';
import { ApiController } from 'src/shared/decorators';
import { FindByIdDto } from 'src/shared/dtos/findById.dto';

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

  @Get(':id')
  async findOne(@Param() findByIdDto: FindByIdDto) {
    return await this.songsService.findOne(findByIdDto.id);
  }
}
