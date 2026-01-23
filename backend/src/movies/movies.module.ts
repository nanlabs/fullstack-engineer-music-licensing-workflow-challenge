import { Module } from '@nestjs/common';
import { MoviesController } from './controllers/movies.controller';
import { CreateMovie } from './application/create.movie';
import { GetMovies } from './application/get.movies';
import { UpdateMovie } from './application/update.movie';
import { GetMovie } from './application/get.movie';
import { RemoveMovie } from './application/remove.movie';
import { GetMovieTracks } from './application/get.movie.tracks';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaMovieRepository } from './infrastructure/prisma.movie.repository';

@Module({
  imports: [],
  controllers: [MoviesController],
  providers: [
    CreateMovie,
    GetMovies,
    UpdateMovie,
    GetMovie,
    RemoveMovie,
    GetMovieTracks,
    PrismaService,
    PrismaMovieRepository,
  ],
})
export class MoviesModule {}
