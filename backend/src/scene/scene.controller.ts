import { Controller, Get, Post, Body, Query, Delete, Param } from '@nestjs/common';
import { SceneService } from './scene.service';
import { Scene } from '../entities/scene.entity';

@Controller('scene')
export class SceneController {
  constructor(private readonly sceneService: SceneService) {}

  @Get()
  findAll(@Query('movieId') movieId?: string): Promise<Scene[]> {
    if (movieId) {
      return this.sceneService.findByMovieId(Number(movieId));
    }
    return this.sceneService.findAll();
  }

  @Delete(':id')
  remove(@Param('id') id: number): Promise<void> {
  return this.sceneService.remove(id);
  }

  @Post()
  create(@Body() data: { name: string; movieId: number }): Promise<Scene> {
    return this.sceneService.create(data);
  }
}
