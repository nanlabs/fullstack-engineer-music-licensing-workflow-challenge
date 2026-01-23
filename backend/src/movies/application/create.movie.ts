import { Injectable } from '@nestjs/common';
import { Movie } from '../domain/movie.interface';
import { PrismaMovieRepository } from '../infrastructure/prisma.movie.repository';

@Injectable()
export class CreateMovie {
    constructor( private readonly movie: PrismaMovieRepository) {}
    async execute(data: Omit<Movie, 'id' | 'scenes'>): Promise<Movie> {
        return this.movie.create(data)
    }
}