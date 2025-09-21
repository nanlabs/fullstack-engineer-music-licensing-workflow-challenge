import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Track } from '../entities/track.entity';

@Injectable()
export class TracksRepository {
  constructor(
    @InjectRepository(Track)
    private readonly trackRepository: Repository<Track>,
  ) {}

  async create(trackData: Partial<Track>): Promise<Track> {
    const track = this.trackRepository.create(trackData);
    return await this.trackRepository.save(track);
  }

  async findAll(): Promise<Track[]> {
    return await this.trackRepository.find({
      relations: {
        song: {
          currentLicenseStatus: true,
        },
        scene: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<Track | null> {
    return await this.trackRepository.findOne({
      where: { id },
      relations: {
        song: {
          currentLicenseStatus: true,
        },
        scene: {
          movie: true,
        },
      },
    });
  }

  async findByIdBasic(id: number): Promise<Track | null> {
    return await this.trackRepository.findOne({
      where: { id },
    });
  }

  async findBySceneId(sceneId: number): Promise<Track[]> {
    return await this.trackRepository.find({
      where: {
        scene: {
          id: sceneId,
        },
      },
      relations: {
        song: {
          currentLicenseStatus: true,
        },
        scene: true,
      },
      order: { startTimeSeconds: 'ASC' },
    });
  }

  async findByMovieId(movieId: number): Promise<Track[]> {
    return this.trackRepository.find({
      where: {
        scene: {
          movieId: movieId,
        },
      },
      relations: {
        scene: true,
        song: {
          currentLicenseStatus: true,
        },
      },
    });
  }

  async findByIdWithScene(id: number): Promise<Track | null> {
    return await this.trackRepository.findOne({
      where: { id },
      relations: {
        scene: true,
      },
    });
  }

  async remove(track: Track): Promise<void> {
    await this.trackRepository.remove(track);
  }

  async exists(id: number): Promise<boolean> {
    const count = await this.trackRepository.count({ where: { id } });
    return count > 0;
  }
}
