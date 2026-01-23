import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, HttpCode } from '@nestjs/common';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { CreateSong } from '../application/create.song';
import { UpdateSong } from '../application/update.song';
import { GetSongs } from '../application/get.songs';
import { GetSong } from '../application/get.song';
import { RemoveSong } from '../application/remove.song';

@Controller('songs')
export class SongsController {
  constructor(
    private readonly createSong: CreateSong,
    private readonly updateSong: UpdateSong,
    private readonly getSongs: GetSongs,
    private readonly getSong: GetSong,
    private readonly removeSong: RemoveSong,
  ){}

    @ApiOperation({ summary: 'Create a new song' })
    @HttpCode(HttpStatus.CREATED)
    @Post()
    @ApiBody({ type: CreateSongDto })
    create(@Body() data: CreateSongDto) {
        return this.createSong.execute(data);
    }

    @ApiOperation({ summary: 'Get all songs' })
    @HttpCode(HttpStatus.OK)
    @Get()
    findAll() {
        return this.getSongs.execute();
    }

    @ApiOperation({ summary: 'Get a song by ID' })
    @HttpCode(HttpStatus.OK)
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.getSong.execute(id);
    }

    @ApiOperation({ summary: 'Update a song by ID' })
    @HttpCode(HttpStatus.OK)
    @Patch(':id')
    @ApiBody({ type: UpdateSongDto })
    update(@Param('id') id: string, @Body() data: UpdateSongDto) {
        return this.updateSong.execute(id, data);
    }

    @ApiOperation({ summary: 'Delete a song by ID' })
    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.removeSong.execute(id);
    }
}