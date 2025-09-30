import { DataSource } from 'typeorm';
import { Movie } from '../entities/movie.entity';
import { Scene } from '../entities/scene.entity';
import { Song } from '../entities/song.entity';
import { Track } from '../entities/track.entity';
import { License } from '../entities/license.entity';
import { LicensingStatus } from '../entities/enums/licensing-status.enum';

export async function seedDatabase(dataSource: DataSource) {
  console.log('Starting database seeding...');

  const movieRepo = dataSource.getRepository(Movie);
  const sceneRepo = dataSource.getRepository(Scene);
  const songRepo = dataSource.getRepository(Song);
  const trackRepo = dataSource.getRepository(Track);
  const licenseRepo = dataSource.getRepository(License);

  // Clear existing data (in correct order due to foreign key constraints)
  console.log('Clearing existing data...');
  await dataSource.query('TRUNCATE TABLE licenses, tracks, scenes, songs, movies RESTART IDENTITY CASCADE');
  console.log('Existing data cleared');

  // Create Movies
  const movie1 = await movieRepo.save({
    title: 'Harry Potter and the Philosopher\'s Stone',
    description: 'A young wizard discovers his magical heritage',
    director: 'Chris Columbus',
    producer: 'David Heyman',
    releaseDate: new Date('2001-11-16'),
    status: 'released',
  });

  const movie2 = await movieRepo.save({
    title: 'The Lord of the Rings: The Fellowship of the Ring',
    description: 'A hobbit begins an epic quest to destroy the One Ring',
    director: 'Peter Jackson',
    producer: 'Peter Jackson',
    releaseDate: new Date('2001-12-19'),
    status: 'released',
  });

  console.log('Movies created');

  // Create Scenes
  const scene1 = await sceneRepo.save({
    name: 'Quidditch Match',
    description: 'Harry\'s first Quidditch game at Hogwarts',
    sceneNumber: 1,
    startTimestamp: 3600,
    endTimestamp: 4020, // startTimestamp + 420 seconds
    movieId: movie1.id,
  });

  const scene2 = await sceneRepo.save({
    name: 'Diagon Alley',
    description: 'Harry discovers the magical shopping district',
    sceneNumber: 2,
    startTimestamp: 1200,
    endTimestamp: 1380, // startTimestamp + 180 seconds
    movieId: movie1.id,
  });

  const scene3 = await sceneRepo.save({
    name: 'Moria Mines',
    description: 'The Fellowship ventures through the dangerous mines of Moria',
    sceneNumber: 1,
    startTimestamp: 4800,
    endTimestamp: 5400, // startTimestamp + 600 seconds
    movieId: movie2.id,
  });

  console.log('Scenes created');

  // Create Songs
  const song1 = await songRepo.save({
    title: 'Quidditch',
    artist: 'John Williams',
    duration: 248,
    rightsHolder: 'Warner Bros Music',
  });

  const song2 = await songRepo.save({
    title: 'Diagon Alley and the Gringotts Vault',
    artist: 'John Williams',
    duration: 253,
    rightsHolder: 'Warner Bros Music',
  });

  const song3 = await songRepo.save({
    title: 'A Journey in the Dark',
    artist: 'Howard Shore',
    duration: 386,
    rightsHolder: 'Reprise Records',
  });

  const song4 = await songRepo.save({
    title: 'The Bridge of Khazad Dum',
    artist: 'Howard Shore',
    duration: 356,
    rightsHolder: 'Reprise Records',
  });

  console.log('Songs created');

  // Create Tracks (with different licensing statuses for testing)
  const track1 = await trackRepo.save({
    name: 'Quidditch Game Music',
    startTime: 30,
    endTime: 210,
    volume: 0.85,
    notes: 'Magical orchestral theme during Harry\'s first Quidditch match',
    sceneId: scene1.id,
    songId: song1.id,
  });

  const track2 = await trackRepo.save({
    name: 'Magical Shopping Theme',
    startTime: 0,
    endTime: 180,
    volume: 0.70,
    notes: 'Wonder and discovery music in Diagon Alley',
    sceneId: scene2.id,
    songId: song2.id,
  });

  const track3 = await trackRepo.save({
    name: 'Moria Darkness',
    startTime: 60,
    endTime: 380,
    volume: 0.90,
    notes: 'Dark and ominous music as Fellowship enters Moria',
    sceneId: scene3.id,
    songId: song3.id,
  });

  const track4 = await trackRepo.save({
    name: 'Bridge of Khazad Dum Battle',
    startTime: 200,
    endTime: 480,
    volume: 0.95,
    notes: 'Intense battle music as Gandalf faces the Balrog',
    sceneId: scene3.id,
    songId: song4.id,
  });

  console.log('Tracks created');

  // Create Licenses with different statuses for testing transitions
  await licenseRepo.save({
    trackId: track1.id,
    status: LicensingStatus.PENDING,
    licenseFee: 4500,
    currency: 'USD',
    notes: 'Awaiting initial review for Quidditch scene music',
    contactPerson: 'Sarah Williams',
    contactEmail: 'sarah@warnerbrosmusic.com',
    lastStatusChange: new Date(),
  });

  await licenseRepo.save({
    trackId: track2.id,
    status: LicensingStatus.IN_REVIEW,
    licenseFee: 3500,
    currency: 'USD',
    notes: 'Under review by Warner Bros legal team',
    contactPerson: 'Michael Potter',
    contactEmail: 'michael@warnerbrosmusic.com',
    lastStatusChange: new Date(),
  });

  await licenseRepo.save({
    trackId: track3.id,
    status: LicensingStatus.NEGOTIATING,
    licenseFee: 8500,
    currency: 'USD',
    notes: 'Negotiating terms for epic Moria scene',
    contactPerson: 'Gandalf Shore',
    contactEmail: 'gandalf@repriserecords.com',
    lastStatusChange: new Date(),
  });

  await licenseRepo.save({
    trackId: track4.id,
    status: LicensingStatus.APPROVED,
    licenseFee: 9200,
    currency: 'USD',
    notes: 'Approved for epic Balrog battle scene',
    contactPerson: 'Frodo Baggins',
    contactEmail: 'frodo@repriserecords.com',
    lastStatusChange: new Date(),
    licenseStartDate: new Date('2001-01-01'),
    licenseEndDate: new Date('2031-01-01'),
  });

  console.log('Licenses created');
  console.log('Database seeding completed');

  console.log('\nTest Data Summary:');
  console.log('Movies: 2 (Harry Potter, Lord of the Rings)');
  console.log('Scenes: 3 (Quidditch Match, Diagon Alley, Moria Mines)');
  console.log('Songs: 4 (John Williams & Howard Shore film scores)');
  console.log('Tracks: 4 (Different licensing statuses)');
  console.log('Licenses: 4 (PENDING, IN_REVIEW, NEGOTIATING, APPROVED)');

  return {
    movies: [movie1, movie2],
    scenes: [scene1, scene2, scene3],
    songs: [song1, song2, song3, song4],
    tracks: [track1, track2, track3, track4],
  };
}