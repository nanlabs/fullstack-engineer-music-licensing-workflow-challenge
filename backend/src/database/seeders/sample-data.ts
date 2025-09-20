import { DataSource } from 'typeorm';
import { Movie } from '../../modules/movies/entities/movie.entity';
import { Scene } from '../../modules/scenes/entities/scene.entity';
import { Song } from '../../modules/songs/entities/song.entity';
import { Track } from '../../modules/tracks/entities/track.entity';
import { LicenseStatus } from '../../modules/licenses/entities/license-status.entity';
import { LicenseStatusEnum } from '../../common/enums/license-status.enum';

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
      rightsHolder: 'Adventure Music Inc.',
      contactEmail: 'licensing@adventuremusic.com',
    },
    {
      title: 'Heartbeat',
      artist: 'Romantic Vibes',
      album: 'Love Songs Vol. 1',
      releaseYear: 2023,
      genre: 'Pop',
      durationSeconds: 210,
      rightsHolder: 'Romance Records',
      contactEmail: 'rights@romancerecords.com',
    },
    {
      title: 'City Lights',
      artist: 'Urban Sounds',
      album: 'Metropolitan',
      releaseYear: 2022,
      genre: 'Electronic',
      durationSeconds: 165,
      rightsHolder: 'City Music Publishing',
      contactEmail: 'licensing@citymusic.com',
    },
    {
      title: 'Thunder Storm',
      artist: 'Nature Orchestra',
      album: 'Elements',
      releaseYear: 2023,
      genre: 'Ambient',
      durationSeconds: 240,
      rightsHolder: 'Nature Sounds Ltd.',
      contactEmail: 'info@naturesounds.com',
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
      volume: 0.8,
      sceneId: adventureScenes[0].id,
      songId: songs[0].id,
    },
    {
      name: 'Discovery Music',
      startTimeSeconds: 50,
      endTimeSeconds: 180,
      volume: 0.6,
      sceneId: adventureScenes[1].id,
      songId: songs[0].id,
    },
    {
      name: 'Battle Tension',
      startTimeSeconds: 120,
      endTimeSeconds: 240,
      volume: 0.9,
      sceneId: adventureScenes[2].id,
      songId: songs[3].id,
    },
    // City Nights tracks
    {
      name: 'Cafe Ambiance',
      startTimeSeconds: 30,
      endTimeSeconds: 160,
      volume: 0.4,
      sceneId: cityScenes[0].id,
      songId: songs[1].id,
    },
    {
      name: 'City View',
      startTimeSeconds: 20,
      endTimeSeconds: 140,
      volume: 0.7,
      sceneId: cityScenes[1].id,
      songId: songs[2].id,
    },
  ]);

  // Sample license statuses with varied states
  await dataSource.getRepository(LicenseStatus).save([
    // Epic Journey - Approved
    {
      status: LicenseStatusEnum.PENDING,
      notes: 'Initial license request submitted',
      updatedBy: 'John Producer',
      trackId: tracks[0].id,
    },
    {
      status: LicenseStatusEnum.IN_REVIEW,
      notes: 'Under review by rights holder',
      updatedBy: 'Jane Rights Manager',
      trackId: tracks[0].id,
    },
    {
      status: LicenseStatusEnum.APPROVED,
      notes: 'License approved with standard terms',
      updatedBy: 'Jane Rights Manager',
      licenseFee: 2500.0,
      licenseStartDate: new Date('2024-01-01'),
      licenseEndDate: new Date('2024-12-31'),
      contractDetails: 'Standard sync license for theatrical release',
      trackId: tracks[0].id,
    },

    // Discovery Music - In Negotiation
    {
      status: LicenseStatusEnum.PENDING,
      notes: 'License request for epic scene',
      updatedBy: 'John Producer',
      trackId: tracks[1].id,
    },
    {
      status: LicenseStatusEnum.IN_REVIEW,
      notes: 'Reviewing usage context',
      updatedBy: 'Adventure Music Rights',
      trackId: tracks[1].id,
    },
    {
      status: LicenseStatusEnum.NEGOTIATING,
      notes: 'Negotiating fee for extended usage',
      updatedBy: 'John Producer',
      licenseFee: 3000.0,
      trackId: tracks[1].id,
    },

    // Battle Tension - Rejected
    {
      status: LicenseStatusEnum.PENDING,
      notes: 'Request for high-intensity scene',
      updatedBy: 'John Producer',
      trackId: tracks[2].id,
    },
    {
      status: LicenseStatusEnum.REJECTED,
      notes: 'Rights holder declined due to exclusivity agreement',
      updatedBy: 'Nature Sounds Rights',
      trackId: tracks[2].id,
    },

    // Cafe Ambiance - In Review
    {
      status: LicenseStatusEnum.PENDING,
      notes: 'Background music for romantic scene',
      updatedBy: 'Jane Director',
      trackId: tracks[3].id,
    },
    {
      status: LicenseStatusEnum.IN_REVIEW,
      notes: 'Reviewing terms for romantic drama usage',
      updatedBy: 'Romance Records',
      trackId: tracks[3].id,
    },

    // City View - Just submitted
    {
      status: LicenseStatusEnum.PENDING,
      notes: 'Recently submitted license request',
      updatedBy: 'Jane Director',
      trackId: tracks[4].id,
    },
  ]);

  console.log('✅ Sample data seeded successfully!');
  console.log(`📽️  Created ${movies.length} movies`);
  console.log(`🎬 Created ${adventureScenes.length + cityScenes.length} scenes`);
  console.log(`🎵 Created ${songs.length} songs`);
  console.log(`🎼 Created ${tracks.length} tracks`);
  console.log('🔄 Created license status history for all tracks');
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
