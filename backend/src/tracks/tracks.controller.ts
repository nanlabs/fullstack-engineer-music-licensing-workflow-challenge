import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateTrackDto } from './dto/create-tracks.dto';
import { UpdateTrackStatusDto } from './dto/update-tracks.dto';
import { TracksService } from './tracks.service';
import { ApiController } from 'src/shared/decorators';
import { FindByIdDto } from 'src/shared/dtos/findById.dto';

@ApiController('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Post('scenes/:id')
  async createForScene(
    @Param() findByIdDto: FindByIdDto,
    @Body() createTrackDto: CreateTrackDto,
  ) {
    return await this.tracksService.createForScene(
      findByIdDto.id,
      createTrackDto,
    );
  }

  @Get('scenes/:id')
  async findByScene(@Param() findByIdDto: FindByIdDto) {
    return await this.tracksService.findByScene(findByIdDto.id);
  }

  @Patch('status/tracks/:id')
  async updateStatus(
    @Param() findByIdDto: FindByIdDto,
    @Body() updateTrackStatusDto: UpdateTrackStatusDto,
  ) {
    return await this.tracksService.updateStatus(
      findByIdDto.id,
      updateTrackStatusDto,
    );
  }
}
