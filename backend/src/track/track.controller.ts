import { Controller, Get, Post, Body, Query, Delete, Param } from '@nestjs/common';
import { TrackService } from './track.service';
import { Track } from '../entities/track.entity';
import { ParseIntPipe } from '@nestjs/common';

@Controller('track')
export class TrackController {
  constructor(private readonly trackService: TrackService) {}

  @Get()
  findAll(@Query('sceneId') sceneId?: string): Promise<Track[]> {
    if (sceneId) {
      return this.trackService.findBySceneId(Number(sceneId));
    }
    return this.trackService.findAll();
  }
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
  await this.trackService.remove(id); 
  }

  @Post()
  create(@Body() data: any): Promise<Track> {
    return this.trackService.create(data);
  }
}
