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
import { ScenesService } from './scenes.service';
import { CreateSceneDto } from './dto/create-scene.dto';
import { UpdateSceneDto } from './dto/update-scene.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('scenes')
@Controller('scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new scene' })
  @ApiResponse({ status: 201, description: 'Scene created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createSceneDto: CreateSceneDto) {
    return this.scenesService.create(createSceneDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all scenes or scenes by movie with pagination',
  })
  @ApiQuery({
    name: 'movieId',
    required: false,
    description: 'Filter by movie ID',
  })
  @ApiResponse({ status: 200, description: 'List of scenes' })
  findAll(
    @Query('movieId', new ParseUUIDPipe({ optional: true })) movieId?: string,
    @Query() paginationDto?: PaginationDto,
  ) {
    if (movieId) {
      return this.scenesService.findByMovie(movieId);
    }
    return this.scenesService.findAll(
      paginationDto?.page,
      paginationDto?.limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a scene by ID' })
  @ApiResponse({ status: 200, description: 'Scene found' })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.scenesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a scene' })
  @ApiResponse({ status: 200, description: 'Scene updated successfully' })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSceneDto: UpdateSceneDto,
  ) {
    return this.scenesService.update(id, updateSceneDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a scene' })
  @ApiResponse({ status: 204, description: 'Scene deleted successfully' })
  @ApiResponse({ status: 404, description: 'Scene not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.scenesService.remove(id);
  }
}
