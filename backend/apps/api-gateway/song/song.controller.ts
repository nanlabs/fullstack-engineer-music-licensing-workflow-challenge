import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { EventPattern } from '@nestjs/microservices';
import { SongService } from './song.service';
import { CreateSongDto } from 'libs/shared/dto/create-song.dto';

@Controller('/songs')
export class SongController {
  constructor(private readonly songService: SongService) {}

  @Get('/')
  async fetch() {
    return this.songService.fetch();
  }

  @Post()
  async create(@Body() createSongPayload: CreateSongDto) {
    return this.songService.create(createSongPayload);
  }

  @EventPattern('movie.fetch.all.response')
  fetchAllMoviesResponse(payload: any[]) {
    console.log('response', payload);
  }
}
