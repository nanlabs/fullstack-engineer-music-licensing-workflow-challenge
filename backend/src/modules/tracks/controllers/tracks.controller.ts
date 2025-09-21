import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateTrackDto } from '../dto/create-track.dto';
import { Track } from '../entities/track.entity';
import { TracksService } from '../services/tracks.service';

@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new track and associate it with a song' })
  @ApiResponse({ status: 201, description: 'Track created successfully', type: Track })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Scene or Song not found' })
  async create(@Body() createTrackDto: CreateTrackDto): Promise<Track> {
    return await this.tracksService.create(createTrackDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tracks or filter by scene/movie' })
  @ApiQuery({ name: 'sceneId', required: false, description: 'Filter tracks by scene ID' })
  @ApiQuery({ name: 'movieId', required: false, description: 'Filter tracks by movie ID' })
  @ApiResponse({ status: 200, description: 'Tracks retrieved successfully', type: [Track] })
  async findAll(
    @Query('sceneId') sceneId?: number,
    @Query('movieId') movieId?: number,
  ): Promise<Track[]> {
    if (sceneId) {
      return await this.tracksService.findByScene(sceneId);
    }
    if (movieId) {
      return await this.tracksService.findByMovie(movieId);
    }
    return await this.tracksService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a track by ID' })
  @ApiParam({ name: 'id', description: 'Track ID' })
  @ApiResponse({ status: 200, description: 'Track retrieved successfully', type: Track })
  @ApiResponse({ status: 404, description: 'Track not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Track> {
    return await this.tracksService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a track' })
  @ApiParam({ name: 'id', description: 'Track ID' })
  @ApiResponse({ status: 200, description: 'Track deleted successfully' })
  @ApiResponse({ status: 404, description: 'Track not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.tracksService.remove(id);
  }
}
