import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TracksService } from './tracks.service';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { FindAllBySceneIdTrackDto } from './dto/findAllBySceneID-track.dto';
import { FindAllByMovieIdTrackDto } from './dto/findAllByMovieID-track.dto';
import { UpdateTrackLicenseStatusDto } from './dto/updateTrackLicenseStatus-track.dto';

@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new track' })
  @ApiBody({ type: CreateTrackDto })
  @ApiResponse({
    status: 201,
    description: 'Track created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 404,
    description: 'Scene or Song not found',
  })
  create(@Body() createTrackDto: CreateTrackDto) {
    return this.tracksService.create(createTrackDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a track by ID' })
  @ApiParam({
    name: 'id',
    description: 'Track ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Track retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Track not found',
  })
  findOne(@Param('id') id: string) {
    return this.tracksService.findOne(+id);
  }

  @Get('scene/:sceneId')
  @ApiOperation({ summary: 'Get all tracks for a specific scene' })
  @ApiParam({
    name: 'sceneId',
    description: 'Scene ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'List of tracks retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Scene not found',
  })
  findAllBySceneId(
    @Param('sceneId', ParseIntPipe) sceneId: number,
    @Query() findAllBySceneIdTrackDto: FindAllBySceneIdTrackDto,
  ) {
    return this.tracksService.findAllBySceneId(
      sceneId,
      findAllBySceneIdTrackDto,
    );
  }

  @Get('movie/:movieId')
  @ApiOperation({ summary: 'Get all tracks for a specific movie' })
  @ApiParam({
    name: 'movieId',
    description: 'Movie ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'List of tracks retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Movie not found',
  })
  findAllByMovieId(
    @Param('movieId', ParseIntPipe) movieId: number,
    @Query() findAllByMovieIdTrackDto: FindAllByMovieIdTrackDto,
  ) {
    return this.tracksService.findAllByMovieId(
      movieId,
      findAllByMovieIdTrackDto,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a track by ID' })
  @ApiParam({
    name: 'id',
    description: 'Track ID',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateTrackDto })
  @ApiResponse({
    status: 200,
    description: 'Track updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Track not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  update(@Param('id') id: string, @Body() updateTrackDto: UpdateTrackDto) {
    return this.tracksService.update(+id, updateTrackDto);
  }

  @Put(':id/license/status')
  @ApiOperation({ summary: 'Update the license status of a track' })
  @ApiParam({
    name: 'id',
    description: 'Track ID',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateTrackLicenseStatusDto })
  @ApiResponse({
    status: 200,
    description: 'License status updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Track not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or invalid status transition',
  })
  updateLicenseStatus(
    @Param('id') id: string,
    @Body() updateLicenseStatusDto: UpdateTrackLicenseStatusDto,
  ) {
    return this.tracksService.updateLicenseStatus(+id, updateLicenseStatusDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a track by ID (soft delete)' })
  @ApiParam({
    name: 'id',
    description: 'Track ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Track deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Track not found',
  })
  remove(@Param('id') id: string) {
    return this.tracksService.remove(+id);
  }

  @Get(':id/license/history')
  @ApiOperation({ summary: 'Get the license history of a track' })
  @ApiParam({
    name: 'id',
    description: 'Track ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'License history retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Track not found',
  })
  getLicenseHistory(@Param('id') id: string) {
    return this.tracksService.getLicenseHistory(+id);
  }
}
