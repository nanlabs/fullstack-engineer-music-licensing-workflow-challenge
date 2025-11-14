import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';

const logger = new Logger('MoviesService');

@Injectable()
export class MoviesService {
  create(createMovieDto: CreateMovieDto) {
    logger.log('create', createMovieDto);
  }

  findAll() {
    logger.log('findAll');
  }

  async findOne(id: string) {
    logger.log('findOne', id);
  }
}
