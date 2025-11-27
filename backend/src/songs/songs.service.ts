import { Injectable } from '@nestjs/common';
import { SongsRepository } from './songs.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class SongsService {
  constructor(private readonly songsRepository: SongsRepository) {}

  create(createSongDto: Prisma.SongCreateInput) {
    return this.songsRepository.create(createSongDto);
  }

  findAll() {
    return this.songsRepository.findAll();
  }

  findOne(id: string) {
    return this.songsRepository.findOne(id);
  }

  update(id: string, updateSongDto: Prisma.SongUpdateInput) {
    return this.songsRepository.update(id, updateSongDto);
  }

  remove(id: string) {
    return this.songsRepository.remove(id);
  }
}
