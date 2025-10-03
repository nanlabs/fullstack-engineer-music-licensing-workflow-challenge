import { Injectable, Inject } from '@nestjs/common'

import { APPLICATION_ERRORS } from '@/src/app/common/response-normalizer/errors'
import { Order } from '@/src/shared/pagination/page-options'
import { throwError } from '@/src/shared/utils/throw-error'

import { GetMovieByIdRequestDto } from '../infrastructure/controllers/dtos/requests/get-movie-by-id.dto'
import { MoviesRepository } from '../domain/movies.repository.interface'
import { Movies } from '../domain/movies.entity'

@Injectable()
export class MoviesService {
  constructor(
    @Inject(MoviesRepository)
    private readonly moviesRepository: MoviesRepository,
  ) {}

  async findById({ id }: GetMovieByIdRequestDto): Promise<Movies> {
    const movie = await this.moviesRepository.findById(id)
    if (!movie) {
      throwError(APPLICATION_ERRORS.MOVIES.NOT_FOUND_ERROR)
    }
    return movie
  }

  async findAll(
    limit: number,
    offset: number,
    order: Order,
  ): Promise<{ movies: Movies[]; count: number }> {
    const [movies, count] = await this.moviesRepository.findAll(
      limit,
      offset,
      order,
    )
    return {
      movies,
      count,
    }
  }

  async create({ name }: { name: string }): Promise<Movies> {
    const movie = await this.moviesRepository.findByName(name)
    if (movie) {
      throwError(APPLICATION_ERRORS.MOVIES.FOUND_ERROR)
    }
    return await this.moviesRepository.insert({ name })
  }
}
