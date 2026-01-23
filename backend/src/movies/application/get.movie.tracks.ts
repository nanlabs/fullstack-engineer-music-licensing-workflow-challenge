import { Injectable, NotFoundException } from '@nestjs/common';
import { Track } from '../../tracks/domain/track.interface';
import { PrismaMovieRepository } from '../infrastructure/prisma.movie.repository';

@Injectable()
export class GetMovieTracks {
  constructor(private readonly movie: PrismaMovieRepository){}
  async execute(id: string): Promise<Track[] | null> {
    const movie = await this.movie.findOne(id);
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    const tracks: Track[] = []

    if (!movie.scenes) {
      return tracks
    }

    movie.scenes.forEach(scene => {
      tracks.push(...(scene.tracks ?? []))
    })

    return tracks
  }
}