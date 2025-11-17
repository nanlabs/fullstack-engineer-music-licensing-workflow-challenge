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
import { ScenesService } from './scenes.service';
import { CreateSceneDto } from './dto/create-scene.dto';
import { UpdateSceneDto } from './dto/update-scene.dto';
import { FindAllSceneDto } from './dto/findAll-scene.dto';

@ApiTags('scenes')
@Controller('scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new scene' })
  @ApiBody({ type: CreateSceneDto })
  @ApiResponse({
    status: 201,
    description: 'Scene created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 404,
    description: 'Movie not found',
  })
  create(@Body() createSceneDto: CreateSceneDto) {
    return this.scenesService.create(createSceneDto);
  }

  @Get('movie/:movie_id')
  @ApiOperation({ summary: 'Get all scenes for a specific movie' })
  @ApiParam({
    name: 'movie_id',
    description: 'Movie ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'List of scenes retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Movie not found',
  })
  findAllByMovie(
    @Param('movie_id', ParseIntPipe) movie_id: number,
    @Query() findAllSceneDto: FindAllSceneDto,
  ) {
    return this.scenesService.findAllByMovie(movie_id, findAllSceneDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a scene by ID' })
  @ApiParam({
    name: 'id',
    description: 'Scene ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Scene retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Scene not found',
  })
  findOne(@Param('id') id: string) {
    return this.scenesService.findOne(+id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a scene by ID' })
  @ApiParam({
    name: 'id',
    description: 'Scene ID',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateSceneDto })
  @ApiResponse({
    status: 200,
    description: 'Scene updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Scene not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  update(@Param('id') id: string, @Body() updateSceneDto: UpdateSceneDto) {
    return this.scenesService.update(+id, updateSceneDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a scene by ID (soft delete)' })
  @ApiParam({
    name: 'id',
    description: 'Scene ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Scene deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Scene not found',
  })
  remove(@Param('id') id: string) {
    return this.scenesService.remove(+id);
  }
}
