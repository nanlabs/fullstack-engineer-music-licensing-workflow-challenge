import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TracksService } from './tracks.service';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateLicensingStatusDto } from './dto/update-licensing-status.dto';

@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new track with associated song' })
  @ApiResponse({ status: 201, description: 'Track created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createTrackDto: CreateTrackDto) {
    return this.tracksService.create(createTrackDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all tracks or filter by scene/movie with pagination',
  })
  @ApiQuery({
    name: 'sceneId',
    required: false,
    description: 'Filter by scene ID',
  })
  @ApiQuery({
    name: 'movieId',
    required: false,
    description: 'Filter by movie ID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page',
  })
  @ApiResponse({ status: 200, description: 'List of tracks' })
  findAll(
    @Query('sceneId', new ParseUUIDPipe({ optional: true })) sceneId?: string,
    @Query('movieId', new ParseUUIDPipe({ optional: true })) movieId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (sceneId) {
      return this.tracksService.findByScene(sceneId);
    }
    if (movieId) {
      return this.tracksService.findByMovie(movieId);
    }
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.tracksService.findAll(pageNum, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a track by ID with licensing status' })
  @ApiResponse({ status: 200, description: 'Track found' })
  @ApiResponse({ status: 404, description: 'Track not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tracksService.findOne(id);
  }

  @Patch(':id/licensing-status')
  @ApiOperation({ summary: 'Update the licensing status of a track' })
  @ApiResponse({
    status: 200,
    description: 'Licensing status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Track not found' })
  updateLicensingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLicensingStatusDto: UpdateLicensingStatusDto,
  ) {
    return this.tracksService.updateLicensingStatus(
      id,
      updateLicensingStatusDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a track' })
  @ApiResponse({ status: 204, description: 'Track deleted successfully' })
  @ApiResponse({ status: 404, description: 'Track not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tracksService.remove(id);
  }
}
