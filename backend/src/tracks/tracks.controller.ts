import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateTrackDto } from './dto/create-tracks.dto';
import { UpdateTrackStatusDto } from './dto/update-tracks.dto';
import { TracksService } from './tracks.service';
import { ApiController } from 'src/shared/decorators';

@ApiController('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Post('scenes/:sceneId/tracks')
  createForScene(
    @Param('sceneId') sceneId: string,
    @Body() createTrackDto: CreateTrackDto,
  ) {
    return this.tracksService.createForScene(sceneId, createTrackDto);
  }

  @Get('scenes/:sceneId/tracks')
  findByScene(@Param('sceneId') sceneId: string) {
    return this.tracksService.findByScene(sceneId);
  }

  @Patch('tracks/:trackId/status')
  updateStatus(
    @Param('trackId') trackId: string,
    @Body() updateTrackStatusDto: UpdateTrackStatusDto,
  ) {
    return this.tracksService.updateStatus(trackId, updateTrackStatusDto);
  }
}
