import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song } from '../../entities';
import { CreateSongDto, UpdateSongDto } from './dto';

@Injectable()
export class SongsRepository {
  constructor(
    @InjectRepository(Song)
    private typeormRepository: Repository<Song>,
  ) {}

  async create(createSongDto: CreateSongDto): Promise<Song> {
    const song = this.typeormRepository.create(createSongDto);
    return await this.typeormRepository.save(song);
  }

  async findAll(): Promise<Song[]> {
    return await this.typeormRepository.find();
  }

  async findOne(id: string): Promise<Song | null> {
    return await this.typeormRepository.findOne({
      where: { id },
      relations: ['tracks'],
    });
  }

  async update(id: string, updateSongDto: UpdateSongDto): Promise<Song | null> {
    await this.typeormRepository.update(id, updateSongDto);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.typeormRepository.delete(id);
  }
}
