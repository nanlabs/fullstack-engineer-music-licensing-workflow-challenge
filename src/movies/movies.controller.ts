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
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new movie' })
  @ApiResponse({
    status: 201,
    description: 'Movie created successfully',
    example: {
      success: true,
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'The Epic Adventure',
        description: 'An epic journey through time and space',
        director: 'John Director',
        releaseYear: 2024,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      meta: {
        timestamp: '2024-01-01T00:00:00.000Z',
        requestId: '550e8400-e29b-41d4-a716-446655440001',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createMovieDto: CreateMovieDto) {
    return this.moviesService.create(createMovieDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all movies with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of movies',
    example: {
      success: true,
      data: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            title: 'The Epic Adventure',
            description: 'An epic journey through time and space',
            director: 'John Director',
            releaseYear: 2024,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
      meta: {
        timestamp: '2024-01-01T00:00:00.000Z',
        requestId: '550e8400-e29b-41d4-a716-446655440001',
      },
    },
  })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.moviesService.findAll(
      paginationDto.page,
      paginationDto.limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a movie by ID' })
  @ApiResponse({ status: 200, description: 'Movie found' })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.moviesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a movie' })
  @ApiResponse({ status: 200, description: 'Movie updated successfully' })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMovieDto: UpdateMovieDto,
  ) {
    return this.moviesService.update(id, updateMovieDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a movie' })
  @ApiResponse({ status: 204, description: 'Movie deleted successfully' })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.moviesService.remove(id);
  }
}
