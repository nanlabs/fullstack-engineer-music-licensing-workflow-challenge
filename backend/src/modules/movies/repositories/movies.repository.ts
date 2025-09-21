import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '../entities/movie.entity';

@Injectable()
export class MoviesRepository {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {}

  async create(movieData: Partial<Movie>): Promise<Movie> {
    const movie = this.movieRepository.create(movieData);
    return await this.movieRepository.save(movie);
  }

  async findAll(): Promise<Movie[]> {
    return await this.movieRepository.find({
      relations: [
        'scenes',
        'scenes.tracks',
        'scenes.tracks.song',
        'scenes.tracks.licenseStatusesHistory',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<Movie | null> {
    return await this.movieRepository.findOne({
      where: { id },
      relations: [
        'scenes',
        'scenes.tracks',
        'scenes.tracks.song',
        'scenes.tracks.licenseStatusesHistory',
      ],
    });
  }

  async findByIdBasic(id: number): Promise<Movie | null> {
    return await this.movieRepository.findOne({
      where: { id },
    });
  }

  async update(movie: Movie): Promise<Movie> {
    return await this.movieRepository.save(movie);
  }

  async remove(movie: Movie): Promise<void> {
    await this.movieRepository.remove(movie);
  }

  async exists(id: number): Promise<boolean> {
    const count = await this.movieRepository.count({ where: { id } });
    return count > 0;
  }

  async findWithStatistics(id: number): Promise<Movie | null> {
    return await this.movieRepository.findOne({
      where: { id },
      relations: [
        'scenes',
        'scenes.tracks',
        'scenes.tracks.licenseStatusesHistory',
        'scenes.tracks.song',
      ],
    });
  }
}
