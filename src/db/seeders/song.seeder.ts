import { Song } from '@/modules/songs/entities/song.entity';
import { BaseSeeder } from './base.seeder';

export class SongSeeder extends BaseSeeder {
  async seed(): Promise<void> {
    const songRepository = this.dataSource.getRepository(Song);

    const songs = [
      {
        id: 1,
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        genre: 'Rock',
      },
      {
        id: 2,
        title: 'Stairway to Heaven',
        artist: 'Led Zeppelin',
        genre: 'Rock',
      },
      {
        id: 3,
        title: 'Billie Jean',
        artist: 'Michael Jackson',
        genre: 'Pop',
      },
      {
        id: 4,
        title: 'Hotel California',
        artist: 'Eagles',
        genre: 'Rock',
      },
      {
        id: 5,
        title: 'Sweet Child O Mine',
        artist: "Guns N' Roses",
        genre: 'Rock',
      },
      {
        id: 6,
        title: 'Imagine',
        artist: 'John Lennon',
        genre: 'Pop',
      },
      {
        id: 7,
        title: 'Smells Like Teen Spirit',
        artist: 'Nirvana',
        genre: 'Grunge',
      },
      {
        id: 8,
        title: 'Like a Rolling Stone',
        artist: 'Bob Dylan',
        genre: 'Folk Rock',
      },
      {
        id: 9,
        title: 'Thunderstruck',
        artist: 'AC/DC',
        genre: 'Rock',
      },
      {
        id: 10,
        title: 'Purple Rain',
        artist: 'Prince',
        genre: 'Pop Rock',
      },
    ];

    for (const song of songs) {
      const existing = await songRepository.findOne({
        where: { id: song.id },
      });
      if (existing) {
        await songRepository.update(song.id, song);
      } else {
        await songRepository.save(song);
      }
    }
    console.log(`   Upserted ${songs.length} songs`);
  }
}
