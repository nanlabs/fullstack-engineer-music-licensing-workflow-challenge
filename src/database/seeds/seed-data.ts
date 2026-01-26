import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Movie } from '../../entities/movie.entity';
import { Scene } from '../../entities/scene.entity';
import { Song } from '../../entities/song.entity';
import { Track } from '../../entities/track.entity';
import { LicensingStatus } from '../../entities/licensing-status.entity';
import { LicensingState } from '../../entities/track.entity';

const logger = new Logger('SeedData');

export async function seedDatabase(dataSource: DataSource): Promise<void> {
  const movieRepository = dataSource.getRepository(Movie);
  const sceneRepository = dataSource.getRepository(Scene);
  const songRepository = dataSource.getRepository(Song);
  const trackRepository = dataSource.getRepository(Track);
  const licensingStatusRepository = dataSource.getRepository(LicensingStatus);

  // Clear existing data (in reverse order due to foreign key constraints)
  // Using query builder to avoid TRUNCATE issues with foreign keys
  await licensingStatusRepository.createQueryBuilder().delete().execute();
  await trackRepository.createQueryBuilder().delete().execute();
  await sceneRepository.createQueryBuilder().delete().execute();
  await songRepository.createQueryBuilder().delete().execute();
  await movieRepository.createQueryBuilder().delete().execute();

  // Create Movies
  const movie1 = movieRepository.create({
    title: 'The Epic Adventure',
    description: 'An epic journey through time and space',
    director: 'John Director',
    releaseYear: 2024,
  });
  const savedMovie1 = await movieRepository.save(movie1);

  const movie2 = movieRepository.create({
    title: 'Romantic Comedy Nights',
    description: 'A heartwarming romantic comedy',
    director: 'Jane Filmmaker',
    releaseYear: 2024,
  });
  const savedMovie2 = await movieRepository.save(movie2);

  // Create Scenes
  const scene1 = sceneRepository.create({
    movieId: savedMovie1.id,
    title: 'Opening Scene',
    description: 'The hero embarks on their journey',
    sceneNumber: 1,
    startTime: 0,
    endTime: 180,
  });
  const savedScene1 = await sceneRepository.save(scene1);

  const scene2 = sceneRepository.create({
    movieId: savedMovie1.id,
    title: 'Climactic Battle',
    description: 'The final confrontation',
    sceneNumber: 5,
    startTime: 3600,
    endTime: 4200,
  });
  const savedScene2 = await sceneRepository.save(scene2);

  const scene3 = sceneRepository.create({
    movieId: savedMovie2.id,
    title: 'First Meeting',
    description: 'The two leads meet for the first time',
    sceneNumber: 1,
    startTime: 0,
    endTime: 240,
  });
  const savedScene3 = await sceneRepository.save(scene3);

  // Create Songs
  const song1 = songRepository.create({
    title: 'Epic Theme',
    artist: 'The Orchestra',
    album: 'Movie Soundtracks',
    genre: 'Orchestral',
    duration: 180,
    rightsHolder: 'Epic Music Records',
  });
  const savedSong1 = await songRepository.save(song1);

  const song2 = songRepository.create({
    title: 'Battle Anthem',
    artist: 'Metal Warriors',
    album: 'Action Packed',
    genre: 'Rock',
    duration: 240,
    rightsHolder: 'Rock Label Inc',
  });
  const savedSong2 = await songRepository.save(song2);

  const song3 = songRepository.create({
    title: 'Love Theme',
    artist: 'Acoustic Dreams',
    album: 'Romantic Moments',
    genre: 'Acoustic',
    duration: 200,
    rightsHolder: 'Soft Sounds Records',
  });
  const savedSong3 = await songRepository.save(song3);

  const song4 = songRepository.create({
    title: 'Background Ambience',
    artist: 'Ambient Collective',
    album: 'Cinematic Sounds',
    genre: 'Ambient',
    duration: 300,
    rightsHolder: 'Ambient Music Group',
  });
  const savedSong4 = await songRepository.save(song4);

  // Create Tracks
  const track1 = trackRepository.create({
    sceneId: savedScene1.id,
    songId: savedSong1.id,
    startTime: 0,
    endTime: 180,
    currentLicensingStatus: LicensingState.APPROVED,
  });
  const savedTrack1 = await trackRepository.save(track1);

  const track2 = trackRepository.create({
    sceneId: savedScene2.id,
    songId: savedSong2.id,
    startTime: 0,
    endTime: 240,
    currentLicensingStatus: LicensingState.NEGOTIATING,
  });
  const savedTrack2 = await trackRepository.save(track2);

  const track3 = trackRepository.create({
    sceneId: savedScene3.id,
    songId: savedSong3.id,
    startTime: 0,
    endTime: 200,
    currentLicensingStatus: LicensingState.PENDING,
  });
  const savedTrack3 = await trackRepository.save(track3);

  const track4 = trackRepository.create({
    sceneId: savedScene1.id,
    songId: savedSong4.id,
    startTime: 180,
    endTime: 300,
    currentLicensingStatus: LicensingState.REJECTED,
  });
  const savedTrack4 = await trackRepository.save(track4);

  // Create Licensing Status History
  const status1_1 = licensingStatusRepository.create({
    trackId: savedTrack1.id,
    status: LicensingState.PENDING,
    notes: 'Initial request submitted',
    updatedBy: 'admin',
  });
  await licensingStatusRepository.save(status1_1);

  const status1_2 = licensingStatusRepository.create({
    trackId: savedTrack1.id,
    status: LicensingState.NEGOTIATING,
    notes: 'Negotiating terms with rights holder',
    updatedBy: 'admin',
  });
  await licensingStatusRepository.save(status1_2);

  const status1_3 = licensingStatusRepository.create({
    trackId: savedTrack1.id,
    status: LicensingState.APPROVED,
    notes: 'License approved and signed',
    updatedBy: 'admin',
  });
  await licensingStatusRepository.save(status1_3);

  const status2_1 = licensingStatusRepository.create({
    trackId: savedTrack2.id,
    status: LicensingState.PENDING,
    notes: 'Request submitted',
    updatedBy: 'admin',
  });
  await licensingStatusRepository.save(status2_1);

  const status2_2 = licensingStatusRepository.create({
    trackId: savedTrack2.id,
    status: LicensingState.NEGOTIATING,
    notes: 'Currently negotiating pricing',
    updatedBy: 'admin',
  });
  await licensingStatusRepository.save(status2_2);

  const status3_1 = licensingStatusRepository.create({
    trackId: savedTrack3.id,
    status: LicensingState.PENDING,
    notes: 'Awaiting response from rights holder',
    updatedBy: 'admin',
  });
  await licensingStatusRepository.save(status3_1);

  const status4_1 = licensingStatusRepository.create({
    trackId: savedTrack4.id,
    status: LicensingState.PENDING,
    notes: 'Initial request',
    updatedBy: 'admin',
  });
  await licensingStatusRepository.save(status4_1);

  const status4_2 = licensingStatusRepository.create({
    trackId: savedTrack4.id,
    status: LicensingState.REJECTED,
    notes: 'Rights holder declined the request',
    updatedBy: 'admin',
  });
  await licensingStatusRepository.save(status4_2);

  logger.log('Seed data created successfully!');
}
