import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '../movies/entities/movie.entity';
import { Scene } from '../scenes/entities/scene.entity';
import { Song } from '../songs/entities/song.entity';
import { Track } from '../tracks/entities/track.entity';
import { LicensingStatus } from '../tracks/enums/licensing-status.enum';
import {
  SEED_CHASE_SCENE_ID,
  SEED_MOVIE_ID,
  SEED_OPENING_SCENE_ID,
  SEED_SONG_1_ID,
  SEED_SONG_2_ID,
  SEED_TRACK_1_ID,
  SEED_TRACK_2_ID,
  SEED_TRACK_3_ID,
} from './constants/example-ids';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepo: Repository<Movie>,
    @InjectRepository(Scene)
    private readonly sceneRepo: Repository<Scene>,
    @InjectRepository(Song)
    private readonly songRepo: Repository<Song>,
    @InjectRepository(Track)
    private readonly trackRepo: Repository<Track>,
  ) {}

  async runSeed() {
    await this.trackRepo.createQueryBuilder().delete().where('1=1').execute();
    await this.sceneRepo.createQueryBuilder().delete().where('1=1').execute();
    await this.movieRepo.createQueryBuilder().delete().where('1=1').execute();
    await this.songRepo.createQueryBuilder().delete().where('1=1').execute();

    const movie = this.movieRepo.create({
      id: SEED_MOVIE_ID,
      title: 'ACME Bros - Action Movie',
      description: 'Sample movie for music licensing workflow',
      releaseYear: 2025,
    });
    await this.movieRepo.save(movie);

    const openingScene = this.sceneRepo.create({
      id: SEED_OPENING_SCENE_ID,
      name: 'Opening credits',
      order: 1,
      movie,
    });
    const chaseScene = this.sceneRepo.create({
      id: SEED_CHASE_SCENE_ID,
      name: 'Car chase',
      order: 2,
      movie,
    });
    await this.sceneRepo.save([openingScene, chaseScene]);

    const song1 = this.songRepo.create({
      id: SEED_SONG_1_ID,
      title: 'Epic Intro Theme',
      artist: 'ACME Orchestra',
      album: 'Movie Themes Vol. 1',
      durationSeconds: 180,
    });

    const song2 = this.songRepo.create({
      id: SEED_SONG_2_ID,
      title: 'High Speed Chase',
      artist: 'Rock Band X',
      album: 'Adrenaline',
      durationSeconds: 200,
    });

    await this.songRepo.save([song1, song2]);

    const track1 = this.trackRepo.create({
      id: SEED_TRACK_1_ID,
      scene: openingScene,
      song: song1,
      startTime: 0,
      endTime: 60,
      licensingStatus: LicensingStatus.APPROVED,
      notes: 'License fully approved for opening credits',
    });

    const track2 = this.trackRepo.create({
      id: SEED_TRACK_2_ID,
      scene: chaseScene,
      song: song2,
      startTime: 10,
      endTime: 90,
      licensingStatus: LicensingStatus.IN_NEGOTIATION,
      notes: 'Negotiation in progress with label',
    });

    const track3 = this.trackRepo.create({
      id: SEED_TRACK_3_ID,
      scene: chaseScene,
      song: song1,
      startTime: 95,
      endTime: 150,
      licensingStatus: LicensingStatus.PENDING,
      notes: 'Waiting for initial response',
    });

    await this.trackRepo.save([track1, track2, track3]);

    return {
      message: 'Database seeded successfully',
      movie,
      scenes: [openingScene, chaseScene],
      songs: [song1, song2],
      tracks: [track1, track2, track3],
    };
  }
}
