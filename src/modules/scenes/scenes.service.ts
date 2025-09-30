import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scene } from '../../entities/scene.entity';
import { Movie } from '../../entities/movie.entity';
import { CreateSceneDto } from './dto/create-scene.dto';
import { UpdateSceneDto } from './dto/update-scene.dto';

@Injectable()
export class ScenesService {
  constructor(
    @InjectRepository(Scene)
    private readonly sceneRepository: Repository<Scene>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {}

  async create(createSceneDto: CreateSceneDto): Promise<Scene> {
    const movie = await this.movieRepository.findOne({
      where: { id: createSceneDto.movieId },
    });

    if (!movie) {
      throw new NotFoundException(`Movie with ID ${createSceneDto.movieId} not found`);
    }

    const scene = this.sceneRepository.create({
      ...createSceneDto,
      movie,
    });

    return await this.sceneRepository.save(scene);
  }

  async findAll(): Promise<Scene[]> {
    return await this.sceneRepository.find({
      relations: ['movie', 'tracks'],
    });
  }

  async findByMovie(movieId: string): Promise<Scene[]> {
    return await this.sceneRepository.find({
      where: { movie: { id: movieId } },
      relations: ['tracks', 'tracks.song', 'tracks.license'],
    });
  }

  async findOne(id: string): Promise<Scene> {
    const scene = await this.sceneRepository.findOne({
      where: { id },
      relations: ['movie', 'tracks', 'tracks.song', 'tracks.license'],
    });

    if (!scene) {
      throw new NotFoundException(`Scene with ID ${id} not found`);
    }

    return scene;
  }

  async update(id: string, updateSceneDto: UpdateSceneDto): Promise<Scene> {
    const scene = await this.findOne(id);

    if (updateSceneDto.movieId) {
      const movie = await this.movieRepository.findOne({
        where: { id: updateSceneDto.movieId },
      });
      if (!movie) {
        throw new NotFoundException(`Movie with ID ${updateSceneDto.movieId} not found`);
      }
      scene.movie = movie;
    }

    Object.assign(scene, updateSceneDto);
    return await this.sceneRepository.save(scene);
  }

  async remove(id: string): Promise<void> {
    const scene = await this.findOne(id);
    await this.sceneRepository.remove(scene);
  }
}