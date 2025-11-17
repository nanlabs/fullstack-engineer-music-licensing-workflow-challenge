import { Scene } from '@/modules/scenes/entities/scene.entity';
import { Movie } from '@/modules/movies/entities/movie.entity';
import { BaseSeeder } from './base.seeder';

export class SceneSeeder extends BaseSeeder {
  async seed(): Promise<void> {
    const sceneRepository = this.dataSource.getRepository(Scene);
    const movieRepository = this.dataSource.getRepository(Movie);

    const movies = await movieRepository.find();
    if (movies.length === 0) {
      throw new Error('No movies found. Please seed movies first.');
    }

    const scenes = [
      {
        id: 1,
        movie_id: movies[0].id,
        title: 'Opening Sequence',
        description:
          'The dramatic opening scene that sets the tone for the entire movie.',
      },
      {
        id: 2,
        movie_id: movies[0].id,
        title: 'The Chase',
        description: 'A high-speed chase through the city streets.',
      },
      {
        id: 3,
        movie_id: movies[0].id,
        title: 'Climactic Battle',
        description: 'The final confrontation between hero and villain.',
      },
      {
        id: 4,
        movie_id: movies[1].id,
        title: 'First Meeting',
        description:
          'The moment when the two main characters first encounter each other.',
      },
      {
        id: 5,
        movie_id: movies[1].id,
        title: 'Romantic Dinner',
        description: 'An intimate dinner scene with beautiful city views.',
      },
      {
        id: 6,
        movie_id: movies[1].id,
        title: 'The Proposal',
        description: 'The emotional climax where love is declared.',
      },
      {
        id: 7,
        movie_id: movies[2].id,
        title: 'Discovery',
        description: 'The team discovers the entrance to the ancient temple.',
      },
      {
        id: 8,
        movie_id: movies[2].id,
        title: 'Temple Exploration',
        description: 'Navigating through traps and puzzles in the temple.',
      },
      {
        id: 9,
        movie_id: movies[2].id,
        title: 'The Revelation',
        description: 'Uncovering the truth behind the temple and its secrets.',
      },
    ];

    for (const scene of scenes) {
      const existing = await sceneRepository.findOne({
        where: { id: scene.id },
      });
      if (existing) {
        await sceneRepository.update(scene.id, scene);
      } else {
        await sceneRepository.save(scene);
      }
    }
    console.log(`   Upserted ${scenes.length} scenes`);
  }
}
