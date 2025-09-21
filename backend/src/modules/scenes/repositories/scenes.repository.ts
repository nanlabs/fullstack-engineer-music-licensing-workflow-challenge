import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scene } from '../entities/scene.entity';

@Injectable()
export class ScenesRepository {
  constructor(
    @InjectRepository(Scene)
    private readonly sceneRepository: Repository<Scene>,
  ) {}

  async create(sceneData: Partial<Scene>): Promise<Scene> {
    const scene = this.sceneRepository.create(sceneData);
    return await this.sceneRepository.save(scene);
  }

  async findAll(): Promise<Scene[]> {
    return await this.sceneRepository.find({
      relations: ['movie', 'tracks'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<Scene | null> {
    return await this.sceneRepository.findOne({
      where: { id },
      relations: ['movie', 'tracks', 'tracks.song', 'tracks.licenseStatusesHistory'],
    });
  }

  async findByIdBasic(id: number): Promise<Scene | null> {
    return await this.sceneRepository.findOne({
      where: { id },
    });
  }

  async findByMovieId(movieId: number): Promise<Scene[]> {
    return await this.sceneRepository.find({
      where: {
        movie: {
          id: movieId,
        },
      },
      relations: ['tracks', 'tracks.song', 'tracks.licenseStatusesHistory'],
      order: { sceneNumber: 'ASC' },
    });
  }

  async findByMovieIdAndSceneNumber(movieId: number, sceneNumber: number): Promise<Scene | null> {
    return await this.sceneRepository.findOne({
      where: {
        movie: {
          id: movieId,
        },
        sceneNumber: sceneNumber,
      },
    });
  }

  async update(scene: Scene): Promise<Scene> {
    return await this.sceneRepository.save(scene);
  }

  async remove(scene: Scene): Promise<void> {
    await this.sceneRepository.remove(scene);
  }

  async exists(id: number): Promise<boolean> {
    const count = await this.sceneRepository.count({ where: { id } });
    return count > 0;
  }

  async existsSceneNumberInMovie(
    movieId: number,
    sceneNumber: number,
    excludeId?: number,
  ): Promise<boolean> {
    const query = this.sceneRepository
      .createQueryBuilder('scene')
      .where('scene.movieId = :movieId', { movieId })
      .andWhere('scene.sceneNumber = :sceneNumber', { sceneNumber });

    if (excludeId) {
      query.andWhere('scene.id != :excludeId', { excludeId });
    }

    const count = await query.getCount();
    return count > 0;
  }
}
