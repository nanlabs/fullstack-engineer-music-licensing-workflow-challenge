import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ScenesService } from './scenes.service';
import { CreateSceneDto } from './dto/create-scene.dto';
import { ApiController } from 'src/decorators';

@ApiController('scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  @Post()
  create(@Body() createSceneDto: CreateSceneDto) {
    return this.scenesService.create(createSceneDto);
  }

  @Get()
  findAllByMovie(@Query('movieId') movieId: string) {
    return this.scenesService.findAllByMovie(movieId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scenesService.findOne(id);
  }
}
