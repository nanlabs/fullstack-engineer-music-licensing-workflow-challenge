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
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { Song } from '../../entities/song.entity';

@ApiTags('songs')
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new song' })
  @ApiResponse({
    status: 201,
    description: 'Song created successfully',
    type: Song,
  })
  async create(@Body() createSongDto: CreateSongDto): Promise<Song> {
    return await this.songsService.create(createSongDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all songs or search songs' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in title or artist' })
  @ApiResponse({
    status: 200,
    description: 'List of songs',
    type: [Song],
  })
  async findAll(@Query('search') search?: string): Promise<Song[]> {
    if (search) {
      return await this.songsService.search(search);
    }
    return await this.songsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a song by ID' })
  @ApiResponse({
    status: 200,
    description: 'Song found',
    type: Song,
  })
  @ApiResponse({
    status: 404,
    description: 'Song not found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Song> {
    return await this.songsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a song' })
  @ApiResponse({
    status: 200,
    description: 'Song updated successfully',
    type: Song,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSongDto: UpdateSongDto,
  ): Promise<Song> {
    return await this.songsService.update(id, updateSongDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a song' })
  @ApiResponse({
    status: 200,
    description: 'Song deleted successfully',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return await this.songsService.remove(id);
  }
}