import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song } from '../entities/song.entity';

@Injectable()
export class SongService {
  constructor(
    @InjectRepository(Song)
    private readonly songRepo: Repository<Song>,
  ) {}

  findAll(): Promise<Song[]> {
    return this.songRepo.find();
  }

  create(data: Partial<Song>): Promise<Song> {
    const song = this.songRepo.create(data);
    return this.songRepo.save(song);
  }
}
