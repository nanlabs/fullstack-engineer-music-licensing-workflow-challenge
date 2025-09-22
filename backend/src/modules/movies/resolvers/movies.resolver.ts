import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateMovieInput } from '../dto/create-movie.input';
import { UpdateMovieInput } from '../dto/update-movie.input';
import { Movie } from '../entities/movie.entity';
import { MoviesService } from '../services/movies.service';

@Resolver(() => Movie)
export class MoviesResolver {
  constructor(private readonly moviesService: MoviesService) {}

  @Query(() => [Movie], { name: 'movies' })
  async findAll(): Promise<Movie[]> {
    return await this.moviesService.findAll();
  }

  @Query(() => Movie, { name: 'movie' })
  async findOne(@Args('id', { type: () => ID }) id: number): Promise<Movie> {
    return await this.moviesService.findOne(id);
  }

  @Mutation(() => Movie)
  async createMovie(@Args('createMovieInput') createMovieInput: CreateMovieInput): Promise<Movie> {
    return await this.moviesService.create(createMovieInput);
  }

  @Mutation(() => Movie)
  async updateMovie(
    @Args('id', { type: () => ID }) id: number,
    @Args('updateMovieInput') updateMovieInput: UpdateMovieInput,
  ): Promise<Movie> {
    return await this.moviesService.update(id, updateMovieInput);
  }
}
