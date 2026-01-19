import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { TrackService } from './track.service';
import { CreateTrackDto } from 'libs/shared/dto/create-track.dto';
import { LicensingStatus } from 'libs/shared';

@Controller('tracks')
export class TrackController {
  constructor(private readonly trackService: TrackService) {}

  @Get()
  async fetchAll() {
    return this.trackService.fetch();
  }

  @Get(':id')
  async fetchById(@Param('id', ParseIntPipe) id: number) {
    return this.trackService.fetchById(id);
  }

  @Post()
  async create(@Body() createTrackDto: CreateTrackDto) {
    return this.trackService.create(createTrackDto);
  }

  @Patch(':id/licensing')
  async updateLicensingStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: LicensingStatus,
  ) {
    return this.trackService.updateLicensingStatus(id, status);
  }
}
