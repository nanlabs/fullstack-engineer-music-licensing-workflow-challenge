import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scene } from '../../entities';
import { CreateSceneDto, UpdateSceneDto } from './dto';

@Injectable()
export class ScenesRepository {
  constructor(
    @InjectRepository(Scene)
    private typeormRepository: Repository<Scene>,
  ) {}

  async create(createSceneDto: CreateSceneDto): Promise<Scene> {
    const scene = this.typeormRepository.create(createSceneDto);
    return await this.typeormRepository.save(scene);
  }

  async findAll(): Promise<Scene[]> {
    return await this.typeormRepository.find({
      relations: ['movie', 'tracks'],
    });
  }

  async findByMovieId(movieId: string): Promise<Scene[]> {
    return await this.typeormRepository.find({
      where: { movieId },
      relations: ['tracks'],
    });
  }

  async findOne(id: string): Promise<Scene | null> {
    return await this.typeormRepository.findOne({
      where: { id },
      relations: ['movie', 'tracks'],
    });
  }

  async update(
    id: string,
    updateSceneDto: UpdateSceneDto,
  ): Promise<Scene | null> {
    await this.typeormRepository.update(id, updateSceneDto);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.typeormRepository.delete(id);
  }
}
