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
import { ScenesService } from './scenes.service';
import { CreateSceneDto } from './dto/create-scene.dto';
import { UpdateSceneDto } from './dto/update-scene.dto';
import { Scene } from '../../entities/scene.entity';

@ApiTags('scenes')
@Controller('scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new scene' })
  @ApiResponse({
    status: 201,
    description: 'Scene created successfully',
    type: Scene,
  })
  async create(@Body() createSceneDto: CreateSceneDto): Promise<Scene> {
    return await this.scenesService.create(createSceneDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all scenes or scenes by movie' })
  @ApiQuery({ name: 'movieId', required: false, description: 'Filter by movie ID' })
  @ApiResponse({
    status: 200,
    description: 'List of scenes',
    type: [Scene],
  })
  async findAll(@Query('movieId') movieId?: string): Promise<Scene[]> {
    if (movieId) {
      return await this.scenesService.findByMovie(movieId);
    }
    return await this.scenesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a scene by ID' })
  @ApiResponse({
    status: 200,
    description: 'Scene found',
    type: Scene,
  })
  @ApiResponse({
    status: 404,
    description: 'Scene not found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Scene> {
    return await this.scenesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a scene' })
  @ApiResponse({
    status: 200,
    description: 'Scene updated successfully',
    type: Scene,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSceneDto: UpdateSceneDto,
  ): Promise<Scene> {
    return await this.scenesService.update(id, updateSceneDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a scene' })
  @ApiResponse({
    status: 200,
    description: 'Scene deleted successfully',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return await this.scenesService.remove(id);
  }
}