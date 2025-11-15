import { Body, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateTrackDto } from './dto/create-tracks.dto';
import { UpdateTrackStatusDto } from './dto/update-tracks.dto';
import { TracksService } from './tracks.service';
import { ApiController } from 'src/shared/decorators';
import { TrackIdDto } from './dto/track-id.dto';
import { SceneIdDto } from 'src/scenes/dto/scene-id.dto';

@ApiController('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Post('scenes/:sceneId')
  async createForScene(
    @Param() sceneIdDto: SceneIdDto,
    @Body() createTrackDto: CreateTrackDto,
  ) {
    return await this.tracksService.createForScene(sceneIdDto, createTrackDto);
  }

  @Get('scenes/:sceneId')
  async findByScene(@Param() sceneIdDto: SceneIdDto) {
    return await this.tracksService.findByScene(sceneIdDto);
  }

  @Patch('status/tracks/:trackId')
  async updateStatus(
    @Param() trackIdDto: TrackIdDto,
    @Body() updateTrackStatusDto: UpdateTrackStatusDto,
  ) {
    return await this.tracksService.updateStatus(
      trackIdDto,
      updateTrackStatusDto,
    );
  }
}
