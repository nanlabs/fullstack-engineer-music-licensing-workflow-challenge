import { Controller, Param, Query, Body } from '@nestjs/common'

import { SwaggerDocs } from '@/src/shared/decorators/swagger.decorator'
import { Endpoint } from '@/src/shared/decorators/endpoint.decorator'
import { HttpMethods } from '@/src/shared/swagger/api-responses-docs'
import { PageOptionsDto } from '@/src/shared/pagination/page-options'
import { CONTROLLERS } from '@/src/app/constants/api.constants'
import { PageDto } from '@/src/shared/pagination/page-dto'
import { TAGS } from '@/src/app/constants/docs.contants'

import { CreateMovieResponseDto } from './dtos/responses/create-movie.response.dto'
import { CreateMovieRequestDto } from './dtos/requests/create-movie.request.dto'
import { GetMoviesResponseDto } from './dtos/responses/get-movies.response.dto'
import { GetMovieByIdRequestDto } from './dtos/requests/get-movie-by-id.dto'
import { GetMovieByIdResponseDto } from './dtos/responses/movie-by-id.dto'
import { MoviesService } from '../../application/movies.service'
import { Movies } from '../../domain/movies.entity'

@Controller(CONTROLLERS.MOVIES)
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @SwaggerDocs({
    dataDto: GetMovieByIdResponseDto,
    isPaginated: false,
    httpMethod: HttpMethods.get,
    errorResponseCodes: [400, 404],
    tags: TAGS.MOVIES,
    description:
      'Retrieves a movie by its unique identifier. \n\n' +
      'This endpoint returns the complete details of the specified movie. \n\n' +
      'If the movie is not found, a 404 Not Found error will be returned. \n\n',
    summary: 'Get Movie by ID',
    params: { name: 'id', description: 'Movie ID' },
  })
  @Endpoint({
    responseDto: GetMovieByIdResponseDto,
    operation: HttpMethods.get,
    path: ':id',
  })
  async getMovieById(@Param() { id }: GetMovieByIdRequestDto): Promise<Movies> {
    return await this.moviesService.findById({ id })
  }

  @SwaggerDocs({
    dataDto: GetMoviesResponseDto,
    isPaginated: true,
    httpMethod: HttpMethods.get,
    errorResponseCodes: [],
    tags: TAGS.MOVIES,
    description:
      'Retrieves all movies.\n\n' +
      'This endpoint returns a paginated list of movies. You can control pagination with the `limit` and `offset` query parameters.\n' +
      'The `order` parameter sorts the results by the movie creation date (`createdAt`).\n\n' +
      'The response includes:\n' +
      '- `items`: an array of movies for the current page\n' +
      '- `count`: total number of movies available\n' +
      '- Pagination metadata (`pages`, `currentPage`) is included automatically.',
    summary: 'Retrieves all movies',
  })
  @Endpoint({
    responseDto: GetMoviesResponseDto,
    operation: HttpMethods.get,
    isPaginated: true,
  })
  async getMovies(
    @Query() { limit, offset, order }: PageOptionsDto,
  ): Promise<PageDto<Movies>> {
    const { movies: items, count } = await this.moviesService.findAll(
      limit,
      offset,
      order,
    )
    return new PageDto(items, count, limit, offset)
  }

  @SwaggerDocs({
    dataDto: CreateMovieResponseDto,
    isPaginated: false,
    httpMethod: HttpMethods.post,
    errorResponseCodes: [400, 409],
    tags: TAGS.MOVIES,
    description: 'Creates a new movie record',
    summary: 'Create a movie',
  })
  @Endpoint({
    responseDto: CreateMovieResponseDto,
    operation: HttpMethods.post,
  })
  async createMovie(@Body() movie: CreateMovieRequestDto): Promise<Movies> {
    return await this.moviesService.create(movie)
  }
}
