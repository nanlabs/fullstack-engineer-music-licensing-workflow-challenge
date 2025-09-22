import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateSceneDto } from '../dto/create-scene.dto';
import { Scene } from '../entities/scene.entity';
import { ScenesService } from '../services/scenes.service';

@ApiTags('scenes')
@Controller('scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new scene' })
  @ApiResponse({ status: 201, description: 'Scene created successfully', type: Scene })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  async create(@Body() createSceneDto: CreateSceneDto): Promise<Scene> {
    return await this.scenesService.create(createSceneDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all scenes or filter by movie' })
  @ApiQuery({ name: 'movieId', required: false, description: 'Filter scenes by movie ID' })
  @ApiResponse({ status: 200, description: 'Scenes retrieved successfully', type: [Scene] })
  async findAll(@Query('movieId') movieId?: number): Promise<Scene[]> {
    if (movieId) {
      return await this.scenesService.findByMovie(movieId);
    }
    return await this.scenesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a scene by ID' })
  @ApiParam({ name: 'id', description: 'Scene ID' })
  @ApiResponse({ status: 200, description: 'Scene retrieved successfully', type: Scene })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Scene> {
    return await this.scenesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a scene' })
  @ApiParam({ name: 'id', description: 'Scene ID' })
  @ApiResponse({ status: 200, description: 'Scene updated successfully', type: Scene })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSceneDto: Partial<CreateSceneDto>,
  ): Promise<Scene> {
    return await this.scenesService.update(id, updateSceneDto);
  }
}
