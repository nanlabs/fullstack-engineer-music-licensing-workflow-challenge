import { Body, Get, Param, Post, Query } from '@nestjs/common';
import { ScenesService } from './scenes.service';
import { CreateSceneDto } from './dto/create-scene.dto';
import { ApiController } from 'src/shared/decorators';
import { SceneIdDto } from './dto/scene-id.dto';
import { MovieIdDto } from 'src/movies/dto/movie-id.dto';

@ApiController('scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  @Post()
  async create(@Body() createSceneDto: CreateSceneDto) {
    return this.scenesService.create(createSceneDto);
  }

  @Get()
  async findAllByMovie(@Query() movieIdDto: MovieIdDto) {
    return await this.scenesService.findAllByMovie(movieIdDto);
  }

  @Get(':sceneId')
  async findOne(@Param() sceneIdDto: SceneIdDto) {
    return await this.scenesService.findOne(sceneIdDto);
  }
}
