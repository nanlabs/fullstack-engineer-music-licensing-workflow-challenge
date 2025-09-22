import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song } from '../entities/song.entity';

@Injectable()
export class SongsRepository {
  constructor(
    @InjectRepository(Song)
    private readonly songRepository: Repository<Song>,
  ) {}

  async create(songData: Partial<Song>): Promise<Song> {
    const song = this.songRepository.create(songData);
    return await this.songRepository.save(song);
  }

  async findAll(): Promise<Song[]> {
    return await this.songRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<Song | null> {
    return await this.songRepository.findOne({
      where: { id },
      relations: {
        tracks: true,
        currentLicenseStatus: true,
      },
    });
  }

  async findByIdBasic(id: number): Promise<Song | null> {
    return await this.songRepository.findOne({
      where: { id },
    });
  }

  async update(song: Song): Promise<Song> {
    return await this.songRepository.save(song);
  }

  async remove(song: Song): Promise<void> {
    await this.songRepository.remove(song);
  }

  async exists(id: number): Promise<boolean> {
    const count = await this.songRepository.count({ where: { id } });
    return count > 0;
  }

  async search(query: string): Promise<Song[]> {
    return await this.songRepository
      .createQueryBuilder('song')
      .where('song.title ILIKE :query', { query: `%${query}%` })
      .orWhere('song.artist ILIKE :query', { query: `%${query}%` })
      .orWhere('song.album ILIKE :query', { query: `%${query}%` })
      .orderBy('song.title', 'ASC')
      .getMany();
  }
}
