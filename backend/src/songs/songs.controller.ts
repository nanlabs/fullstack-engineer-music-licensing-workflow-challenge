import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SongsService } from './songs.service';
import { CreateSongDto, UpdateSongDto } from './dto/song.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('songs')
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new song' })
  @ApiResponse({ status: 201, description: 'The song has been successfully created.' })
  create(@Body() createSongDto: CreateSongDto) {
    return this.songsService.create(createSongDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all songs' })
  @ApiResponse({ status: 200, description: 'Return all songs.' })
  findAll() {
    return this.songsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a song by ID' })
  @ApiResponse({ status: 200, description: 'Return the song.' })
  @ApiResponse({ status: 404, description: 'Song not found.' })
  findOne(@Param('id') id: string) {
    return this.songsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a song' })
  @ApiResponse({ status: 200, description: 'The song has been successfully updated.' })
  update(@Param('id') id: string, @Body() updateSongDto: UpdateSongDto) {
    return this.songsService.update(id, updateSongDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a song' })
  @ApiResponse({ status: 200, description: 'The song has been successfully deleted.' })
  remove(@Param('id') id: string) {
    return this.songsService.remove(id);
  }
}
