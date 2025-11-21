import { Injectable } from '@nestjs/common';
import { Scene } from '../../entities';
import { CreateSceneDto, UpdateSceneDto } from './dto';
import { ScenesRepository } from './scenes.repository';

@Injectable()
export class ScenesService {
  constructor(private scenesRepository: ScenesRepository) {}

  async create(createSceneDto: CreateSceneDto): Promise<Scene> {
    return await this.scenesRepository.create(createSceneDto);
  }

  async findAll(): Promise<Scene[]> {
    return await this.scenesRepository.findAll();
  }

  async findByMovieId(movieId: string): Promise<Scene[]> {
    return await this.scenesRepository.findByMovieId(movieId);
  }

  async findOne(id: string): Promise<Scene | null> {
    return await this.scenesRepository.findOne(id);
  }

  async update(
    id: string,
    updateSceneDto: UpdateSceneDto,
  ): Promise<Scene | null> {
    return await this.scenesRepository.update(id, updateSceneDto);
  }

  async remove(id: string): Promise<void> {
    return await this.scenesRepository.remove(id);
  }
}
