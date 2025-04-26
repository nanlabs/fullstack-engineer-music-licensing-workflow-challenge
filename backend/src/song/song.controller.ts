import { Controller, Get, Post, Body } from '@nestjs/common';
import { SongService } from './song.service';
import { Song } from '../entities/song.entity';

@Controller('song')
export class SongController {
  constructor(private readonly songService: SongService) {}

  @Get()
  getAll(): Promise<Song[]> {
    return this.songService.findAll();
  }

  @Post()
  create(@Body() body: Partial<Song>): Promise<Song> {
    return this.songService.create(body);
  }
}
