import { Movie } from '@/modules/movies/entities/movie.entity';
import { BaseSeeder } from './base.seeder';

export class MovieSeeder extends BaseSeeder {
  async seed(): Promise<void> {
    const movieRepository = this.dataSource.getRepository(Movie);

    const movies = [
      {
        id: 1,
        title: 'The Epic Adventure',
        description:
          'A thrilling journey through time and space as heroes battle against impossible odds.',
      },
      {
        id: 2,
        title: 'City Lights',
        description:
          'A romantic drama set in the heart of a bustling metropolis, following two strangers who find love.',
      },
      {
        id: 3,
        title: 'Mystery of the Lost Temple',
        description:
          'An archaeological adventure uncovering ancient secrets and hidden treasures.',
      },
    ];

    for (const movie of movies) {
      const existing = await movieRepository.findOne({
        where: { id: movie.id },
      });
      if (existing) {
        await movieRepository.update(movie.id, movie);
      } else {
        await movieRepository.save(movie);
      }
    }
    console.log(`   Upserted ${movies.length} movies`);
  }
}
