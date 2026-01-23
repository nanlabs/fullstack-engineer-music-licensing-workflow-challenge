import { Body, Controller, Post, Param, Patch, ValidationPipe, Get } from '@nestjs/common';
import { UpdateTrackStatusDto } from './dto/update.track.status.dto';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { UpdateTrackLicensingStatus } from '../application/update.track.licensing.status';
import { CreateTrackDto } from './dto/create.track.dto';
import { CreateTrack } from '../application/create.track';
import { GetTracks } from '../application/get.tracks';

@Controller('tracks')
export class TracksController {
  constructor(
    private readonly updateTrack: UpdateTrackLicensingStatus,
    private readonly createTrack: CreateTrack,
    private readonly getTracks: GetTracks,
  ) {}

  @ApiOperation({ summary: 'Get all tracks' })
  @Get()
  async getAllTracks() {
    return this.getTracks.execute()
  }

  @ApiOperation({ summary: 'Create a new track' })
  @ApiBody({ type: CreateTrackDto })
  @Post()
  async addTrack(@Body() data: CreateTrackDto) {
    return this.createTrack.execute(data)
  }
  
  @ApiOperation({ summary: 'Update track licensing status' })
  @ApiBody({ type: UpdateTrackStatusDto })
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body(ValidationPipe) body: UpdateTrackStatusDto,
  ) {
    return this.updateTrack.execute(id, body.status)
  }

}