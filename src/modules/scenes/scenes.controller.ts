import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ScenesService } from './scenes.service';
import { CreateSceneDto, UpdateSceneDto } from './dto';

@ApiTags('scenes')
@Controller('api/scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  @ApiOperation({ summary: 'Create a new scene' })
  @ApiResponse({ status: 201, description: 'Scene created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @Post()
  create(@Body() createSceneDto: CreateSceneDto) {
    return this.scenesService.create(createSceneDto);
  }

  @ApiOperation({ summary: 'Get all scenes' })
  @ApiResponse({ status: 200, description: 'List of all scenes' })
  @Get()
  findAll() {
    return this.scenesService.findAll();
  }

  @ApiOperation({ summary: 'Get scenes by movie ID' })
  @ApiResponse({ status: 200, description: 'List of scenes for the movie' })
  @Get('movie/:movieId')
  findByMovieId(@Param('movieId') movieId: string) {
    return this.scenesService.findByMovieId(movieId);
  }

  @ApiOperation({ summary: 'Get a scene by ID' })
  @ApiResponse({ status: 200, description: 'Scene found' })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scenesService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a scene' })
  @ApiResponse({ status: 200, description: 'Scene updated successfully' })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSceneDto: UpdateSceneDto) {
    return this.scenesService.update(id, updateSceneDto);
  }

  @ApiOperation({ summary: 'Delete a scene' })
  @ApiResponse({ status: 200, description: 'Scene deleted successfully' })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.scenesService.remove(id);
  }
}
