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
import { SongsService } from './songs.service';
import { CreateSongDto, UpdateSongDto } from './dto';

@ApiTags('songs')
@Controller('api/songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @ApiOperation({ summary: 'Create a new song' })
  @ApiResponse({ status: 201, description: 'Song created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @Post()
  create(@Body() createSongDto: CreateSongDto) {
    return this.songsService.create(createSongDto);
  }

  @ApiOperation({ summary: 'Get all songs' })
  @ApiResponse({ status: 200, description: 'List of all songs' })
  @Get()
  findAll() {
    return this.songsService.findAll();
  }

  @ApiOperation({ summary: 'Get a song by ID' })
  @ApiResponse({ status: 200, description: 'Song found' })
  @ApiResponse({ status: 404, description: 'Song not found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.songsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a song' })
  @ApiResponse({ status: 200, description: 'Song updated successfully' })
  @ApiResponse({ status: 404, description: 'Song not found' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSongDto: UpdateSongDto) {
    return this.songsService.update(id, updateSongDto);
  }

  @ApiOperation({ summary: 'Delete a song' })
  @ApiResponse({ status: 200, description: 'Song deleted successfully' })
  @ApiResponse({ status: 404, description: 'Song not found' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.songsService.remove(id);
  }
}
