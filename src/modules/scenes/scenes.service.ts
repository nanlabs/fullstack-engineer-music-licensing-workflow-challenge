import { Injectable } from '@nestjs/common';
import { Scene } from '../../entities';
import { CreateSceneDto, UpdateSceneDto } from './dto';
import { ScenesRepository } from './scenes.repository';
import {
  ResourceNotFoundException,
  DuplicateResourceException,
} from '../../common/exceptions';
import { MoviesRepository } from '../movies/movies.repository';

@Injectable()
export class ScenesService {
  constructor(
    private scenesRepository: ScenesRepository,
    private moviesRepository: MoviesRepository,
  ) {}

  async create(createSceneDto: CreateSceneDto): Promise<Scene> {
    const movie = await this.moviesRepository.findOne(createSceneDto.movieId);
    if (!movie) {
      throw new ResourceNotFoundException('Movie', createSceneDto.movieId);
    }

    // Check if sceneNumber already exists for this movie
    const existingScenes = await this.scenesRepository.findByMovieId(
      createSceneDto.movieId,
    );
    const duplicateScene = existingScenes.find(
      (scene) => scene.sceneNumber === createSceneDto.sceneNumber,
    );
    if (duplicateScene) {
      throw new DuplicateResourceException(
        'Scene',
        'sceneNumber',
        String(createSceneDto.sceneNumber),
      );
    }

    return await this.scenesRepository.create(createSceneDto);
  }

  async findAll(): Promise<Scene[]> {
    return await this.scenesRepository.findAll();
  }

  async findByMovieId(movieId: string): Promise<Scene[]> {
    return await this.scenesRepository.findByMovieId(movieId);
  }

  async findOne(id: string): Promise<Scene> {
    const scene = await this.scenesRepository.findOne(id);
    if (!scene) {
      throw new ResourceNotFoundException('Scene', id);
    }
    return scene;
  }

  async update(id: string, updateSceneDto: UpdateSceneDto): Promise<Scene> {
    const scene = await this.scenesRepository.update(id, updateSceneDto);
    if (!scene) {
      throw new ResourceNotFoundException('Scene', id);
    }
    return scene;
  }

  async remove(id: string): Promise<{ message: string }> {
    const scene = await this.scenesRepository.findOne(id);
    if (!scene) {
      throw new ResourceNotFoundException('Scene', id);
    }
    await this.scenesRepository.remove(id);
    return { message: 'Scene deleted successfully' };
  }
}
