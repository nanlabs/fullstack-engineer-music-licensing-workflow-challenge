import { Body, Get, Param, Post, Query } from '@nestjs/common';
import { ScenesService } from './scenes.service';
import { CreateSceneDto } from './dto/create-scene.dto';
import { ApiController } from 'src/shared/decorators';
import { FindByIdDto } from 'src/shared/dtos/findById.dto';

@ApiController('scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  @Post()
  async create(@Body() createSceneDto: CreateSceneDto) {
    return this.scenesService.create(createSceneDto);
  }

  @Get()
  async findAllByMovie(@Query() findByIdDto: FindByIdDto) {
    return await this.scenesService.findAllByMovie(findByIdDto.id);
  }

  @Get(':id')
  async findOne(@Param() findByIdDto: FindByIdDto) {
    return await this.scenesService.findOne(findByIdDto.id);
  }
}
