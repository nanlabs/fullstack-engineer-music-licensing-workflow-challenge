import { Controller, Get, HttpCode, HttpStatus, Param, Post, Body } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Track } from '../../tracks/domain/track.interface';
import { GetSceneTracks } from '../application/get.scene.tracks';
import { CreateSceneDto } from './dto/create.scene.dto';
import { CreateScene } from '../application/create.scene';
import { Scene } from '../domain/scene.interface';

@Controller('scenes')
export class ScenesController {
  constructor(
    private readonly getSceneTracks: GetSceneTracks,
    private readonly createScene: CreateScene,
  ) {}
  
  @ApiOperation({ summary: 'Get all tracks for a scene' })
  @HttpCode(HttpStatus.OK)
  @Get(':id/tracks')
  async findAll(@Param('id') id: string): Promise<Track[] | null> {
      return this.getSceneTracks.execute(id);
  }

  @ApiOperation({ summary: 'Create a new scene' })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async create( @Body() createSceneDto: CreateSceneDto): Promise<Scene> {
      return this.createScene.execute(createSceneDto);
  }

}