import { Track } from '@/modules/tracks/entities/track.entity';
import { Scene } from '@/modules/scenes/entities/scene.entity';
import { Song } from '@/modules/songs/entities/song.entity';
import { BaseSeeder } from './base.seeder';

export class TrackSeeder extends BaseSeeder {
  async seed(): Promise<void> {
    const trackRepository = this.dataSource.getRepository(Track);
    const sceneRepository = this.dataSource.getRepository(Scene);
    const songRepository = this.dataSource.getRepository(Song);

    const scenes = await sceneRepository.find({ order: { id: 'ASC' } });
    const songs = await songRepository.find({ order: { id: 'ASC' } });

    if (scenes.length === 0) {
      throw new Error('No scenes found. Please seed scenes first.');
    }
    if (songs.length === 0) {
      throw new Error('No songs found. Please seed songs first.');
    }

    const tracks = [
      {
        id: 1,
        scene_id: scenes[0].id,
        song_id: songs[0].id,
        start_time_seconds: 0,
        end_time_seconds: 30,
      },
      {
        id: 2,
        scene_id: scenes[0].id,
        song_id: songs[1].id,
        start_time_seconds: 30,
        end_time_seconds: 90,
      },
      {
        id: 3,
        scene_id: scenes[1].id,
        song_id: songs[2].id,
        start_time_seconds: 0,
        end_time_seconds: 45,
      },
      {
        id: 4,
        scene_id: scenes[1].id,
        song_id: songs[3].id,
        start_time_seconds: 45,
        end_time_seconds: 120,
      },
      {
        id: 5,
        scene_id: scenes[2].id,
        song_id: songs[4].id,
        start_time_seconds: 0,
        end_time_seconds: 60,
      },
      {
        id: 6,
        scene_id: scenes[3].id,
        song_id: songs[5].id,
        start_time_seconds: 0,
        end_time_seconds: 40,
      },
      {
        id: 7,
        scene_id: scenes[4].id,
        song_id: songs[6].id,
        start_time_seconds: 0,
        end_time_seconds: 50,
      },
      {
        id: 8,
        scene_id: scenes[5].id,
        song_id: songs[7].id,
        start_time_seconds: 0,
        end_time_seconds: 35,
      },
      {
        id: 9,
        scene_id: scenes[6].id,
        song_id: songs[8].id,
        start_time_seconds: 0,
        end_time_seconds: 45,
      },
      {
        id: 10,
        scene_id: scenes[7].id,
        song_id: songs[9].id,
        start_time_seconds: 0,
        end_time_seconds: 55,
      },
      {
        id: 11,
        scene_id: scenes[8].id,
        song_id: songs[0].id,
        start_time_seconds: 0,
        end_time_seconds: 70,
      },
    ];

    for (const track of tracks) {
      const existing = await trackRepository.findOne({
        where: { id: track.id },
      });
      if (existing) {
        await trackRepository.update(track.id, track);
      } else {
        await trackRepository.save(track);
      }
    }
    console.log(`   Upserted ${tracks.length} tracks`);
  }
}
