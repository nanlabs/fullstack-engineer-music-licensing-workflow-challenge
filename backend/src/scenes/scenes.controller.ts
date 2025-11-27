import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ScenesService } from './scenes.service';
import { CreateSceneDto, UpdateSceneDto } from './dto/scene.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('scenes')
@Controller('scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new scene' })
  @ApiResponse({ status: 201, description: 'The scene has been successfully created.' })
  create(@Body() createSceneDto: CreateSceneDto) {
    return this.scenesService.create(createSceneDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all scenes' })
  @ApiResponse({ status: 200, description: 'Return all scenes.' })
  findAll() {
    return this.scenesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a scene by ID' })
  @ApiResponse({ status: 200, description: 'Return the scene.' })
  @ApiResponse({ status: 404, description: 'Scene not found.' })
  findOne(@Param('id') id: string) {
    return this.scenesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a scene' })
  @ApiResponse({ status: 200, description: 'The scene has been successfully updated.' })
  update(@Param('id') id: string, @Body() updateSceneDto: UpdateSceneDto) {
    return this.scenesService.update(id, updateSceneDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a scene' })
  @ApiResponse({ status: 200, description: 'The scene has been successfully deleted.' })
  remove(@Param('id') id: string) {
    return this.scenesService.remove(id);
  }
}
