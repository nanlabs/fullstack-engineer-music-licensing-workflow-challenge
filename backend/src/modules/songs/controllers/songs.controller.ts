import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SongsService } from '../services/songs.service';
import { CreateSongDto } from '../dto/create-song.dto';
import { Song } from '../entities/song.entity';

@ApiTags('songs')
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new song' })
  @ApiResponse({ status: 201, description: 'Song created successfully', type: Song })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createSongDto: CreateSongDto): Promise<Song> {
    return await this.songsService.create(createSongDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all songs or search by query' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query for title, artist, or album' })
  @ApiResponse({ status: 200, description: 'Songs retrieved successfully', type: [Song] })
  async findAll(@Query('q') query?: string): Promise<Song[]> {
    if (query) {
      return await this.songsService.search(query);
    }
    return await this.songsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a song by ID' })
  @ApiParam({ name: 'id', description: 'Song ID' })
  @ApiResponse({ status: 200, description: 'Song retrieved successfully', type: Song })
  @ApiResponse({ status: 404, description: 'Song not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Song> {
    return await this.songsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a song' })
  @ApiParam({ name: 'id', description: 'Song ID' })
  @ApiResponse({ status: 200, description: 'Song updated successfully', type: Song })
  @ApiResponse({ status: 404, description: 'Song not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSongDto: Partial<CreateSongDto>,
  ): Promise<Song> {
    return await this.songsService.update(id, updateSongDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a song' })
  @ApiParam({ name: 'id', description: 'Song ID' })
  @ApiResponse({ status: 200, description: 'Song deleted successfully' })
  @ApiResponse({ status: 404, description: 'Song not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.songsService.remove(id);
  }
}
