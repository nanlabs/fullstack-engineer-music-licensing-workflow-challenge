import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TracksService } from './tracks.service';
import { CreateTrackDto, UpdateTrackDto } from './dto/track.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new track' })
  @ApiResponse({ status: 201, description: 'The track has been successfully created.' })
  create(@Body() createTrackDto: CreateTrackDto) {
    return this.tracksService.create(createTrackDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tracks' })
  @ApiResponse({ status: 200, description: 'Return all tracks.' })
  findAll() {
    return this.tracksService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a track by ID' })
  @ApiResponse({ status: 200, description: 'Return the track.' })
  @ApiResponse({ status: 404, description: 'Track not found.' })
  findOne(@Param('id') id: string) {
    return this.tracksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a track' })
  @ApiResponse({ status: 200, description: 'The track has been successfully updated.' })
  update(@Param('id') id: string, @Body() updateTrackDto: UpdateTrackDto) {
    return this.tracksService.update(id, updateTrackDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a track' })
  @ApiResponse({ status: 200, description: 'The track has been successfully deleted.' })
  remove(@Param('id') id: string) {
    return this.tracksService.remove(id);
  }
}
