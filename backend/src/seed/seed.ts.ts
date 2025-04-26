/* Run with this command to repopulate the database -> npx ts-node seed.ts  */


import { DataSource } from 'typeorm';
import { Movie } from './src/entities/movie.entity';
import { Scene } from './src/entities/scene.entity';
import { Song } from './src/entities/song.entity';
import { LicenseStatus } from './src/entities/license-status.entity';
import { Track } from './src/entities/track.entity';
import { AppDataSource } from './src/data-source';

async function seed() {
  await AppDataSource.initialize();
  const movieRepo = AppDataSource.getRepository(Movie);
  const sceneRepo = AppDataSource.getRepository(Scene);
  const songRepo = AppDataSource.getRepository(Song);
  const licenseRepo = AppDataSource.getRepository(LicenseStatus);
  const trackRepo = AppDataSource.getRepository(Track);

  const movies = [
    { title: 'Resonance of Destiny', description: 'An orchestral journey through fate and time' },
    { title: 'Echo Pulse', description: 'Sci-fi beats shaping a digital revolution' },
    { title: 'Strings of Eternity', description: 'A violinist’s timeless tale of love and sound' },
    { title: 'Synthwave Horizon', description: 'Retro-futuristic rhythms under neon skies' },
    { title: 'Ballad of Silence', description: 'The sound of silence explored in cinematic depth' }
  ];

  const savedMovies = await movieRepo.save(movies);

  let sceneId = 1;
  let songId = 1;
  const allScenes: Scene[] = [];
  const allSongs: Song[] = [];
  const allTracks: Track[] = [];

  for (const [i, movie] of savedMovies.entries()) {
    for (let j = 1; j <= 5; j++) {
      const scene = sceneRepo.create({
        name: `${movie.title} - Scene ${j}`,
        movie: movie,
      });
      allScenes.push(scene);

      const song = songRepo.create({
        title: `${movie.title} - Tema ${j}`,
        artist: `Artist ${sceneId}`,
        duration: 180 + j * 5,
      });
      allSongs.push(song);

      sceneId++;
    }
  }

  const savedScenes = await sceneRepo.save(allScenes);
  const savedSongs = await songRepo.save(allSongs);

  const statuses = ['NEGOTIATION', 'APPROVED', 'PENDING', 'REJECTED'];
  const savedStatuses = await licenseRepo.save(
    statuses.map((status) => ({ status }))
  );

  for (let i = 0; i < savedScenes.length; i++) {
    const scene = savedScenes[i];
    const song = savedSongs[i];
    const status = savedStatuses[i % savedStatuses.length];

    const track = trackRepo.create({
      startTime: '00:00:0' + (5 + (i % 5) * 15),
      endTime: '00:00:3' + (5 + (i % 5) * 15),
      scene,
      song,
      licenseStatus: status,
    });
    allTracks.push(track);
  }

  await trackRepo.save(allTracks);
  console.log('✅ Seed completed successfully');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Seed failed', err);
  process.exit(1);
});