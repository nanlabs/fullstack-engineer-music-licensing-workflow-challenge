import { DataSource } from 'typeorm';
import { LicenseStatusEnum } from '../../common/enums/license-status.enum';
import { LicenseStatus } from '../../modules/licenses/entities/license-status.entity';
import { Movie } from '../../modules/movies/entities/movie.entity';
import { Scene } from '../../modules/scenes/entities/scene.entity';
import { Song } from '../../modules/songs/entities/song.entity';
import { Track } from '../../modules/tracks/entities/track.entity';

export async function seedSampleData(dataSource: DataSource) {
  console.log('🌱 Seeding sample data...');

  // Clear existing data
  await dataSource.query('TRUNCATE TABLE movies.license_statuses CASCADE');
  await dataSource.query('TRUNCATE TABLE movies.tracks CASCADE');
  await dataSource.query('TRUNCATE TABLE movies.scenes CASCADE');
  await dataSource.query('TRUNCATE TABLE movies.movies CASCADE');
  await dataSource.query('TRUNCATE TABLE movies.songs CASCADE');

  // Sample movies
  const movies = await dataSource.getRepository(Movie).save([
    {
      title: 'The Great Adventure',
      description: 'An epic adventure film about discovering hidden treasures',
      director: 'John Smith',
      releaseYear: 2024,
      status: 'production',
    },
    {
      title: 'City Nights',
      description: 'A romantic drama set in the bustling city',
      director: 'Jane Doe',
      releaseYear: 2024,
      status: 'post-production',
    },
  ]);

  // Sample songs
  const songs = await dataSource.getRepository(Song).save([
    {
      title: 'Epic Journey',
      artist: 'Adventure Band',
      album: 'Soundtrack Adventures',
      releaseYear: 2023,
      genre: 'Orchestral',
      durationSeconds: 180,
    },
    {
      title: 'Heartbeat',
      artist: 'Romantic Vibes',
      album: 'Love Songs Vol. 1',
      releaseYear: 2023,
      genre: 'Pop',
      durationSeconds: 210,
    },
    {
      title: 'City Lights',
      artist: 'Urban Sounds',
      album: 'Metropolitan',
      releaseYear: 2022,
      genre: 'Electronic',
      durationSeconds: 165,
    },
    {
      title: 'Thunder Storm',
      artist: 'Nature Orchestra',
      album: 'Elements',
      releaseYear: 2023,
      genre: 'Ambient',
      durationSeconds: 240,
    },
  ]);

  // Sample scenes for The Great Adventure
  const adventureScenes = await dataSource.getRepository(Scene).save([
    {
      name: 'Opening Sequence',
      description: 'Hero begins the journey',
      sceneNumber: 1,
      durationSeconds: 300,
      movieId: movies[0].id,
    },
    {
      name: 'The Discovery',
      description: 'Finding the ancient map',
      sceneNumber: 2,
      durationSeconds: 420,
      movieId: movies[0].id,
    },
    {
      name: 'Final Battle',
      description: 'Climactic confrontation',
      sceneNumber: 3,
      durationSeconds: 600,
      movieId: movies[0].id,
    },
  ]);

  // Sample scenes for City Nights
  const cityScenes = await dataSource.getRepository(Scene).save([
    {
      name: 'Meeting at Cafe',
      description: 'First encounter between protagonists',
      sceneNumber: 1,
      durationSeconds: 250,
      movieId: movies[1].id,
    },
    {
      name: 'Rooftop Romance',
      description: 'Romantic scene overlooking the city',
      sceneNumber: 2,
      durationSeconds: 180,
      movieId: movies[1].id,
    },
  ]);

  // Sample tracks
  const tracks = await dataSource.getRepository(Track).save([
    // The Great Adventure tracks
    {
      name: 'Opening Theme',
      startTimeSeconds: 10,
      endTimeSeconds: 70,
      sceneId: adventureScenes[0].id,
      songId: songs[0].id,
    },
    {
      name: 'Discovery Music',
      startTimeSeconds: 50,
      endTimeSeconds: 180,
      sceneId: adventureScenes[1].id,
      songId: songs[0].id,
    },
    {
      name: 'Battle Tension',
      startTimeSeconds: 120,
      endTimeSeconds: 240,
      sceneId: adventureScenes[2].id,
      songId: songs[3].id,
    },
    // City Nights tracks
    {
      name: 'Cafe Ambiance',
      startTimeSeconds: 30,
      endTimeSeconds: 160,
      sceneId: cityScenes[0].id,
      songId: songs[1].id,
    },
    {
      name: 'City View',
      startTimeSeconds: 20,
      endTimeSeconds: 140,
      sceneId: cityScenes[1].id,
      songId: songs[2].id,
    },
  ]);

  // Sample license statuses with varied states (now for songs)
  const licenseStatuses = await dataSource.getRepository(LicenseStatus).save([
    // Epic Journey - Approved
    {
      status: LicenseStatusEnum.PENDING,
      songId: songs[0].id,
    },
    {
      status: LicenseStatusEnum.IN_REVIEW,
      songId: songs[0].id,
    },
    {
      status: LicenseStatusEnum.APPROVED,
      songId: songs[0].id,
    },

    // Heartbeat - In Negotiation
    {
      status: LicenseStatusEnum.PENDING,
      songId: songs[1].id,
    },
    {
      status: LicenseStatusEnum.IN_REVIEW,
      songId: songs[1].id,
    },
    {
      status: LicenseStatusEnum.NEGOTIATING,
      songId: songs[1].id,
    },

    // City Lights - Rejected
    {
      status: LicenseStatusEnum.PENDING,
      songId: songs[2].id,
    },
    {
      status: LicenseStatusEnum.REJECTED,
      songId: songs[2].id,
    },

    // Thunder Storm - In Review
    {
      status: LicenseStatusEnum.PENDING,
      songId: songs[3].id,
    },
    {
      status: LicenseStatusEnum.IN_REVIEW,
      songId: songs[3].id,
    },
  ]);

  // Update songs with their current license status (most recent status for each song)
  const songUpdates = [
    { songId: songs[0].id, currentLicenseStatusId: licenseStatuses[2].id }, // APPROVED
    { songId: songs[1].id, currentLicenseStatusId: licenseStatuses[5].id }, // NEGOTIATING
    { songId: songs[2].id, currentLicenseStatusId: licenseStatuses[7].id }, // REJECTED
    { songId: songs[3].id, currentLicenseStatusId: licenseStatuses[9].id }, // IN_REVIEW
  ];

  for (const update of songUpdates) {
    await dataSource
      .getRepository(Song)
      .update({ id: update.songId }, { currentLicenseStatusId: update.currentLicenseStatusId });
  }

  console.log('✅ Sample data seeded successfully!');
  console.log(`📽️  Created ${movies.length} movies`);
  console.log(`🎬 Created ${adventureScenes.length + cityScenes.length} scenes`);
  console.log(`🎵 Created ${songs.length} songs`);
  console.log(`🎼 Created ${tracks.length} tracks`);
  console.log('🔄 Created license status history for all songs');
}

// CLI runner
if (require.main === module) {
  import('../data-source').then(({ AppDataSource }) => {
    AppDataSource.initialize()
      .then(async () => {
        await seedSampleData(AppDataSource);
        await AppDataSource.destroy();
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
      });
  });
}
