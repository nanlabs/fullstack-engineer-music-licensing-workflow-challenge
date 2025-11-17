import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { FindAllSongDto } from './dto/findAll-song.dto';

@ApiTags('songs')
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new song' })
  @ApiBody({ type: CreateSongDto })
  @ApiResponse({
    status: 201,
    description: 'Song created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  create(@Body() createSongDto: CreateSongDto) {
    return this.songsService.create(createSongDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all songs with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'List of songs retrieved successfully',
  })
  findAll(@Query() findAllSongDto: FindAllSongDto) {
    return this.songsService.findAll(findAllSongDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a song by ID' })
  @ApiParam({
    name: 'id',
    description: 'Song ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Song retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Song not found',
  })
  findOne(@Param('id') id: string) {
    return this.songsService.findOne(+id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a song by ID' })
  @ApiParam({
    name: 'id',
    description: 'Song ID',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateSongDto })
  @ApiResponse({
    status: 200,
    description: 'Song updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Song not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  update(@Param('id') id: string, @Body() updateSongDto: UpdateSongDto) {
    return this.songsService.update(+id, updateSongDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a song by ID (soft delete)' })
  @ApiParam({
    name: 'id',
    description: 'Song ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Song deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Song not found',
  })
  remove(@Param('id') id: string) {
    return this.songsService.remove(+id);
  }
}
