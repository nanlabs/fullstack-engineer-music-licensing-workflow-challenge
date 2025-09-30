import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TracksService } from './tracks.service';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { Track } from '../../entities/track.entity';

@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new track' })
  @ApiResponse({
    status: 201,
    description: 'Track created successfully with initial license',
    type: Track,
  })
  async create(@Body() createTrackDto: CreateTrackDto): Promise<Track> {
    return await this.tracksService.create(createTrackDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tracks or tracks by scene' })
  @ApiQuery({ name: 'sceneId', required: false, description: 'Filter by scene ID' })
  @ApiResponse({
    status: 200,
    description: 'List of tracks',
    type: [Track],
  })
  async findAll(@Query('sceneId') sceneId?: string): Promise<Track[]> {
    if (sceneId) {
      return await this.tracksService.findByScene(sceneId);
    }
    return await this.tracksService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a track by ID' })
  @ApiResponse({
    status: 200,
    description: 'Track found',
    type: Track,
  })
  @ApiResponse({
    status: 404,
    description: 'Track not found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Track> {
    return await this.tracksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a track' })
  @ApiResponse({
    status: 200,
    description: 'Track updated successfully',
    type: Track,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTrackDto: UpdateTrackDto,
  ): Promise<Track> {
    return await this.tracksService.update(id, updateTrackDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a track' })
  @ApiResponse({
    status: 200,
    description: 'Track deleted successfully',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return await this.tracksService.remove(id);
  }
}