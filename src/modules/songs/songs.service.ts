import { Injectable } from '@nestjs/common';
import { Song } from '../../entities';
import { CreateSongDto, UpdateSongDto } from './dto';
import { SongsRepository } from './songs.repository';
import { ResourceNotFoundException } from '../../common/exceptions';

@Injectable()
export class SongsService {
  constructor(private songsRepository: SongsRepository) {}

  async create(createSongDto: CreateSongDto): Promise<Song> {
    return await this.songsRepository.create(createSongDto);
  }

  async findAll(): Promise<Song[]> {
    return await this.songsRepository.findAll();
  }

  async findOne(id: string): Promise<Song> {
    const song = await this.songsRepository.findOne(id);
    if (!song) {
      throw new ResourceNotFoundException('Song', id);
    }
    return song;
  }

  async update(id: string, updateSongDto: UpdateSongDto): Promise<Song> {
    const song = await this.songsRepository.update(id, updateSongDto);
    if (!song) {
      throw new ResourceNotFoundException('Song', id);
    }
    return song;
  }

  async remove(id: string): Promise<{ message: string }> {
    const song = await this.songsRepository.findOne(id);
    if (!song) {
      throw new ResourceNotFoundException('Song', id);
    }
    await this.songsRepository.remove(id);
    return { message: 'Song deleted successfully' };
  }
}
