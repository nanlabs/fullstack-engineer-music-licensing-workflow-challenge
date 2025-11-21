import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '../../entities';
import { CreateMovieDto, UpdateMovieDto } from './dto';

@Injectable()
export class MoviesRepository {
  constructor(
    @InjectRepository(Movie)
    private typeormRepository: Repository<Movie>,
  ) {}

  async create(createMovieDto: CreateMovieDto): Promise<Movie> {
    const movie = this.typeormRepository.create(createMovieDto);
    return await this.typeormRepository.save(movie);
  }

  async findAll(): Promise<Movie[]> {
    return await this.typeormRepository.find({
      relations: ['scenes'],
    });
  }

  async findOne(id: string): Promise<Movie | null> {
    return await this.typeormRepository.findOne({
      where: { id },
      relations: ['scenes'],
    });
  }

  async update(
    id: string,
    updateMovieDto: UpdateMovieDto,
  ): Promise<Movie | null> {
    await this.typeormRepository.update(id, updateMovieDto);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.typeormRepository.delete(id);
  }
}
