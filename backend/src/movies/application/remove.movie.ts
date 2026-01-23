import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaMovieRepository } from '../infrastructure/prisma.movie.repository';

@Injectable()
export class RemoveMovie {
  constructor(private readonly movie: PrismaMovieRepository){}
  
  async execute(id: string): Promise<void> {
    const movie = await this.movie.findOne(id)
    
    if (!movie) {
        throw new NotFoundException('Movie not found')
    }

    return this.movie.remove(id)
  }
}