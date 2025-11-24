import { Injectable } from '@nestjs/common';
import { Song } from '../../entities';
import { CreateSongDto, UpdateSongDto } from './dto';
import { SongsRepository } from './songs.repository';

@Injectable()
export class SongsService {
  constructor(private songsRepository: SongsRepository) {}

  async create(createSongDto: CreateSongDto): Promise<Song> {
    return await this.songsRepository.create(createSongDto);
  }

  async findAll(): Promise<Song[]> {
    return await this.songsRepository.findAll();
  }

  async findOne(id: string): Promise<Song | null> {
    return await this.songsRepository.findOne(id);
  }

  async update(id: string, updateSongDto: UpdateSongDto): Promise<Song | null> {
    return await this.songsRepository.update(id, updateSongDto);
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.songsRepository.remove(id);
    return { message: 'Song deleted successfully' };
  }
}
