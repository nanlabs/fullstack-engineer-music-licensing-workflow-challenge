import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MoviesService } from '../../movies/services/movies.service';
import { CreateSceneDto } from '../dto/create-scene.dto';
import { Scene } from '../entities/scene.entity';
import { ScenesRepository } from '../repositories/scenes.repository';

@Injectable()
export class ScenesService {
  constructor(
    private readonly scenesRepository: ScenesRepository,
    private readonly moviesService: MoviesService,
  ) {}

  async create(createSceneDto: CreateSceneDto): Promise<Scene> {
    // Business rule: Movie must exist before creating a scene
    const movieExists = await this.moviesService.exists(createSceneDto.movieId);
    if (!movieExists) {
      throw new NotFoundException(`Movie with ID ${createSceneDto.movieId} not found`);
    }

    // Business rule: Scene number must be unique within a movie
    await this.validateUniqueSceneNumber(createSceneDto.movieId, createSceneDto.sceneNumber);

    // Business rule: Validate scene data
    this.validateSceneData(createSceneDto);

    return await this.scenesRepository.create(createSceneDto);
  }

  async findAll(): Promise<Scene[]> {
    return await this.scenesRepository.findAll();
  }

  async findOne(id: number): Promise<Scene> {
    const scene = await this.scenesRepository.findById(id);

    if (!scene) {
      throw new NotFoundException(`Scene with ID ${id} not found`);
    }

    return scene;
  }

  async findByMovie(movieId: number): Promise<Scene[]> {
    // Business rule: Movie must exist
    const movieExists = await this.moviesService.exists(movieId);
    if (!movieExists) {
      throw new NotFoundException(`Movie with ID ${movieId} not found`);
    }

    return await this.scenesRepository.findByMovieId(movieId);
  }

  async update(id: number, updateSceneDto: Partial<CreateSceneDto>): Promise<Scene> {
    // Business rule: Scene must exist
    const scene = await this.findOne(id);

    // Business rule: Validate update data
    if (updateSceneDto.sceneNumber !== undefined) {
      this.validateSceneData(updateSceneDto as CreateSceneDto);
    }

    // Business rule: Scene number must be unique within movie if changing
    if (updateSceneDto.sceneNumber && updateSceneDto.sceneNumber !== scene.sceneNumber) {
      await this.validateUniqueSceneNumber(scene.movie.id, updateSceneDto.sceneNumber, id);
    }

    // Apply updates
    Object.assign(scene, updateSceneDto);
    return await this.scenesRepository.update(scene);
  }

  async exists(id: number): Promise<boolean> {
    return await this.scenesRepository.exists(id);
  }

  // Private business logic methods
  private async validateUniqueSceneNumber(
    movieId: number,
    sceneNumber: number,
    excludeId?: number,
  ): Promise<void> {
    const sceneExists = await this.scenesRepository.existsSceneNumberInMovie(
      movieId,
      sceneNumber,
      excludeId,
    );
    if (sceneExists) {
      throw new BadRequestException(`Scene number ${sceneNumber} already exists for this movie`);
    }
  }

  private validateSceneData(sceneData: CreateSceneDto | Partial<CreateSceneDto>): void {
    // Business rule: Scene number must be positive
    if (sceneData.sceneNumber !== undefined && sceneData.sceneNumber <= 0) {
      throw new BadRequestException('Scene number must be positive');
    }

    // Business rule: Duration must be positive if provided
    if (sceneData.durationSeconds !== undefined && sceneData.durationSeconds <= 0) {
      throw new BadRequestException('Duration must be positive');
    }
  }
}
