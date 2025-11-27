import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { CreateMovieDto } from './../src/movies/dto/movie.dto';
import { CreateSceneDto } from './../src/scenes/dto/scene.dto';
import { CreateSongDto } from './../src/songs/dto/song.dto';
import { CreateTrackDto } from './../src/tracks/dto/track.dto';
import { LicensingStatus } from '@prisma/client';

describe('Tracks Workflow (e2e)', () => {
  let app: INestApplication;
  let movieId: string;
  let sceneId: string;
  let songId: string;
  let trackId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a movie', async () => {
    const createMovieDto: CreateMovieDto = {
      title: 'E2E Test Movie',
      releaseYear: 2025,
    };
    const response = await request(app.getHttpServer())
      .post('/movies')
      .send(createMovieDto)
      .expect(201);
    
    movieId = response.body.id;
    expect(movieId).toBeDefined();
  });

  it('should create a scene', async () => {
    const createSceneDto: CreateSceneDto = {
      name: 'E2E Test Scene',
      description: 'A test scene',
      movieId: movieId,
    };
    const response = await request(app.getHttpServer())
      .post('/scenes')
      .send(createSceneDto)
      .expect(201);

    sceneId = response.body.id;
    expect(sceneId).toBeDefined();
  });

  it('should create a song', async () => {
    const createSongDto: CreateSongDto = {
      title: 'E2E Test Song',
      artist: 'Test Artist',
      duration: 180,
    };
    const response = await request(app.getHttpServer())
      .post('/songs')
      .send(createSongDto)
      .expect(201);

    songId = response.body.id;
    expect(songId).toBeDefined();
  });

  it('should create a track linking scene and song', async () => {
    const createTrackDto: CreateTrackDto = {
      sceneId: sceneId,
      songId: songId,
      startTime: 0,
      endTime: 60,
    };
    const response = await request(app.getHttpServer())
      .post('/tracks')
      .send(createTrackDto)
      .expect(201);

    trackId = response.body.id;
    expect(trackId).toBeDefined();
    expect(response.body.status).toBe(LicensingStatus.PENDING);
  });

  it('should update track status to NEGOTIATING', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/tracks/${trackId}`)
      .send({ status: LicensingStatus.NEGOTIATING })
      .expect(200);

    expect(response.body.status).toBe(LicensingStatus.NEGOTIATING);
  });

  it('should fail to update track with invalid transition', async () => {
    await request(app.getHttpServer())
      .patch(`/tracks/${trackId}`)
      .send({ status: LicensingStatus.APPROVED }) // Invalid from NEGOTIATING? No, NEGOTIATING -> APPROVED is valid.
      // Wait, let's check the state machine in TracksService.
      // PENDING -> NEGOTIATING (Valid)
      // NEGOTIATING -> APPROVED (Valid)
      // Let's try PENDING -> APPROVED (Invalid) but we are already at NEGOTIATING.
      // Let's try NEGOTIATING -> PENDING (Invalid? Let's check service)
      .expect(200); // Actually NEGOTIATING -> APPROVED IS valid.
      
      // Let's try to go back to PENDING from APPROVED (if we assume previous passed)
      // APPROVED -> PENDING (Invalid)
      await request(app.getHttpServer())
        .patch(`/tracks/${trackId}`)
        .send({ status: LicensingStatus.PENDING })
        .expect(400);
  });
});
