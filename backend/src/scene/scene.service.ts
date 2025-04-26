import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scene } from '../entities/scene.entity';
import { Movie } from '../entities/movie.entity';

@Injectable()
export class SceneService {
  constructor(
    @InjectRepository(Scene)
    private sceneRepository: Repository<Scene>,

    @InjectRepository(Movie)
    private movieRepository: Repository<Movie>,
  ) {}

  async create(data: { name: string; movieId: number }): Promise<Scene> {
    const movie = await this.movieRepository.findOne({
      where: { id: data.movieId },
    });

    if (!movie) throw new Error('Movie not found');

    const scene = this.sceneRepository.create({
      name: data.name,
      movie,
    });

    return this.sceneRepository.save(scene);
  }

  async remove(id: number): Promise<void> {
    await this.sceneRepository.delete(id);
  }

  async findAll(): Promise<Scene[]> {
    return this.sceneRepository.find({
      relations: ['movie', 'tracks'],
    });
  }

  async findByMovieId(movieId: number): Promise<Scene[]> {
    return this.sceneRepository.find({
      where: { movie: { id: movieId } },
      relations: ['movie', 'tracks'],
    });
  }
}
