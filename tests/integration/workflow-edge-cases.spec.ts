import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { Movie } from '../../src/entities/movie.entity';
import { Scene } from '../../src/entities/scene.entity';
import { Song } from '../../src/entities/song.entity';
import { Track } from '../../src/entities/track.entity';
import { LicensingState } from '../../src/entities/track.entity';

describe('Workflow and Edge Cases Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let movieId: string;
  let sceneId: string;
  let songId: string;
  let trackId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Set global prefix to match production
    app.setGlobalPrefix('api');
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    // Clean up test data
    if (dataSource.isInitialized) {
      const trackRepo = dataSource.getRepository(Track);
      const sceneRepo = dataSource.getRepository(Scene);
      const songRepo = dataSource.getRepository(Song);
      const movieRepo = dataSource.getRepository(Movie);

      if (trackId) {
        await trackRepo.delete({ id: trackId });
      }
      if (sceneId) {
        await sceneRepo.delete({ id: sceneId });
      }
      if (songId) {
        await songRepo.delete({ id: songId });
      }
      if (movieId) {
        await movieRepo.delete({ id: movieId });
      }
    }
    await app.close();
  });

  describe('Normal Workflow', () => {
    it('should complete the full workflow: Movie -> Scene -> Song -> Track -> Update Status', async () => {
      const timestamp = Date.now();

      // Step 1: Create Movie
      const movieResponse = await request(app.getHttpServer())
        .post('/api/movies')
        .send({
          title: `Workflow Test Movie ${timestamp}`,
          description: 'Test movie for workflow',
          director: 'Test Director',
          releaseYear: 2024,
        })
        .expect(201);

      expect(movieResponse.body.success).toBe(true);
      expect(movieResponse.body.data).toHaveProperty('id');
      expect(movieResponse.body.data.title).toContain('Workflow Test Movie');
      movieId = movieResponse.body.data.id;

      // Step 2: Create Scene
      const sceneResponse = await request(app.getHttpServer())
        .post('/api/scenes')
        .send({
          movieId: movieId,
          title: 'Opening Scene',
          description: 'The opening scene',
          sceneNumber: 1,
          startTime: 0,
          endTime: 180,
        })
        .expect(201);

      expect(sceneResponse.body.success).toBe(true);
      expect(sceneResponse.body.data).toHaveProperty('id');
      sceneId = sceneResponse.body.data.id;

      // Step 3: Create Song
      const songResponse = await request(app.getHttpServer())
        .post('/api/songs')
        .send({
          title: `Workflow Test Song ${timestamp}`,
          artist: 'Test Artist',
          album: 'Test Album',
          genre: 'Rock',
          duration: 180,
          rightsHolder: 'Test Records',
        })
        .expect(201);

      expect(songResponse.body.success).toBe(true);
      expect(songResponse.body.data).toHaveProperty('id');
      songId = songResponse.body.data.id;

      // Step 4: Create Track
      const trackResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          sceneId: sceneId,
          songId: songId,
          startTime: 0,
          endTime: 180,
        })
        .expect(201);

      expect(trackResponse.body.success).toBe(true);
      expect(trackResponse.body.data).toHaveProperty('id');
      expect(trackResponse.body.data.currentLicensingStatus).toBe(
        LicensingState.PENDING,
      );
      trackId = trackResponse.body.data.id;

      // Step 5: Update Licensing Status
      const statusResponse = await request(app.getHttpServer())
        .patch(`/api/tracks/${trackId}/licensing-status`)
        .send({
          status: LicensingState.NEGOTIATING,
          notes: 'Starting negotiations',
          updatedBy: 'test-user',
        })
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.currentLicensingStatus).toBe(
        LicensingState.NEGOTIATING,
      );
      expect(statusResponse.body.data.licensingStatusHistory).toHaveLength(2);

      // Step 6: Verify relationships
      const movieWithScenes = await request(app.getHttpServer())
        .get(`/api/movies/${movieId}`)
        .expect(200);

      expect(movieWithScenes.body.data.scenes).toHaveLength(1);
      expect(movieWithScenes.body.data.scenes[0].id).toBe(sceneId);

      const sceneWithTracks = await request(app.getHttpServer())
        .get(`/api/scenes/${sceneId}`)
        .expect(200);

      expect(sceneWithTracks.body.data.tracks).toHaveLength(1);
      expect(sceneWithTracks.body.data.tracks[0].id).toBe(trackId);
    });

    it('should retrieve paginated lists correctly', async () => {
      // Get movies with pagination
      const moviesResponse = await request(app.getHttpServer())
        .get('/api/movies?page=1&limit=10')
        .expect(200);

      expect(moviesResponse.body.success).toBe(true);
      expect(moviesResponse.body.data).toHaveProperty('data');
      expect(moviesResponse.body.data).toHaveProperty('meta');
      expect(moviesResponse.body.data.meta).toHaveProperty('page', 1);
      expect(moviesResponse.body.data.meta).toHaveProperty('limit', 10);

      // Get scenes with pagination
      const scenesResponse = await request(app.getHttpServer())
        .get('/api/scenes?page=1&limit=10')
        .expect(200);

      expect(scenesResponse.body.success).toBe(true);
      expect(scenesResponse.body.data.meta).toHaveProperty('page', 1);
    });

    it('should filter scenes by movieId', async () => {
      const scenesResponse = await request(app.getHttpServer())
        .get(`/api/scenes?movieId=${movieId}`)
        .expect(200);

      expect(scenesResponse.body.success).toBe(true);
      expect(Array.isArray(scenesResponse.body.data)).toBe(true);
      expect(scenesResponse.body.data.length).toBeGreaterThan(0);
      expect(scenesResponse.body.data[0].movieId).toBe(movieId);
    });

    it('should filter tracks by sceneId', async () => {
      const tracksResponse = await request(app.getHttpServer())
        .get(`/api/tracks?sceneId=${sceneId}`)
        .expect(200);

      expect(tracksResponse.body.success).toBe(true);
      expect(Array.isArray(tracksResponse.body.data)).toBe(true);
      expect(tracksResponse.body.data.length).toBeGreaterThan(0);
      expect(tracksResponse.body.data[0].sceneId).toBe(sceneId);
    });
  });

  describe('Edge Cases - Validation', () => {
    it('should reject empty title when creating movie', async () => {
      await request(app.getHttpServer())
        .post('/api/movies')
        .send({
          title: '',
          releaseYear: 2024,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toContain('title');
        });
    });

    it('should reject missing title when creating movie', async () => {
      await request(app.getHttpServer())
        .post('/api/movies')
        .send({
          releaseYear: 2024,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
        });
    });

    it('should reject negative page in pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/movies?page=-1')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Page must be greater|must be greater than or equal to 1|must not be less than 1/i);
    });

    it('should reject page 0 in pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/movies?page=0')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Page must be greater|must be greater than or equal to 1|must not be less than 1/i);
    });

    it('should reject negative limit in pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/movies?limit=-1')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Limit must be greater|must be greater than or equal to 1|must not be less than 1/i);
    });

    it('should reject limit 0 in pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/movies?limit=0')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Limit must be greater|must be greater than or equal to 1|must not be less than 1/i);
    });

    it('should reject invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/movies/invalid-uuid')
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
        });
    });

    it('should reject scene with endTime <= startTime', async () => {
      await request(app.getHttpServer())
        .post('/api/scenes')
        .send({
          movieId: movieId,
          title: 'Invalid Scene',
          startTime: 100,
          endTime: 50,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toContain('endTime must be greater');
        });
    });

    it('should reject track with endTime <= startTime', async () => {
      await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          sceneId: sceneId,
          songId: songId,
          startTime: 100,
          endTime: 50,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toContain('endTime must be greater');
        });
    });

    it('should reject updating licensing status to same status', async () => {
      // Ensure we have a track from the workflow test
      if (!trackId) {
        // Create a track if workflow test didn't run
        const movieResp = await request(app.getHttpServer())
          .post('/api/movies')
          .send({
            title: `Test Movie ${Date.now()}`,
            releaseYear: 2024,
          })
          .expect(201);
        const tempMovieId = movieResp.body.data.id;

        const sceneResp = await request(app.getHttpServer())
          .post('/api/scenes')
          .send({
            movieId: tempMovieId,
            title: 'Test Scene',
            sceneNumber: 999,
            startTime: 0,
            endTime: 180,
          })
          .expect(201);
        const tempSceneId = sceneResp.body.data.id;

        const songResp = await request(app.getHttpServer())
          .post('/api/songs')
          .send({
            title: `Test Song ${Date.now()}`,
            artist: 'Artist',
            album: 'Album',
            genre: 'Rock',
            duration: 180,
            rightsHolder: 'Records',
          })
          .expect(201);
        const tempSongId = songResp.body.data.id;

        const trackResp = await request(app.getHttpServer())
          .post('/api/tracks')
          .send({
            sceneId: tempSceneId,
            songId: tempSongId,
            startTime: 0,
            endTime: 180,
          })
          .expect(201);
        trackId = trackResp.body.data.id;
      }

      // Get current status
      const trackResponse = await request(app.getHttpServer())
        .get(`/api/tracks/${trackId}`)
        .expect(200);
      const currentStatus = trackResponse.body.data.currentLicensingStatus;

      // Try to update to same status
      await request(app.getHttpServer())
        .patch(`/api/tracks/${trackId}/licensing-status`)
        .send({
          status: currentStatus,
          notes: 'Duplicate status',
          updatedBy: 'test-user',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toMatch(/same status|already/i);
        });
    });

    it('should reject invalid licensing status enum value', async () => {
      await request(app.getHttpServer())
        .patch(`/api/tracks/${trackId}/licensing-status`)
        .send({
          status: 'invalid-status',
          notes: 'Test',
          updatedBy: 'test-user',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
        });
    });

    it('should reject scene with non-existent movieId', async () => {
      const fakeMovieId = '550e8400-e29b-41d4-a716-446655440000';
      await request(app.getHttpServer())
        .post('/api/scenes')
        .send({
          movieId: fakeMovieId,
          title: 'Test Scene',
          sceneNumber: 1,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toContain('not found');
        });
    });

    it('should reject track with non-existent sceneId', async () => {
      const fakeSceneId = '550e8400-e29b-41d4-a716-446655440000';
      await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          sceneId: fakeSceneId,
          songId: songId,
          startTime: 0,
          endTime: 180,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toContain('not found');
        });
    });

    it('should reject track with non-existent songId', async () => {
      const fakeSongId = '550e8400-e29b-41d4-a716-446655440000';
      await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          sceneId: sceneId,
          songId: fakeSongId,
          startTime: 0,
          endTime: 180,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toContain('not found');
        });
    });

    it('should reject unknown fields in request body', async () => {
      await request(app.getHttpServer())
        .post('/api/movies')
        .send({
          title: 'Test Movie',
          releaseYear: 2024,
          unknownField: 'should be rejected',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toContain('unknownField');
        });
    });

    it('should reject invalid data types', async () => {
      await request(app.getHttpServer())
        .post('/api/movies')
        .send({
          title: 123, // Should be string
          releaseYear: 'not-a-number', // Should be number
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
        });
    });

    it('should reject negative release year', async () => {
      await request(app.getHttpServer())
        .post('/api/movies')
        .send({
          title: 'Test Movie',
          releaseYear: -1,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
        });
    });

    it('should reject negative duration for song', async () => {
      await request(app.getHttpServer())
        .post('/api/songs')
        .send({
          title: 'Test Song',
          artist: 'Artist',
          album: 'Album',
          genre: 'Rock',
          duration: -1,
          rightsHolder: 'Records',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
        });
    });
  });

  describe('Edge Cases - Pagination', () => {
    it('should handle very large page numbers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/movies?page=999999&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.meta.page).toBe(999999);
      expect(response.body.data.data).toHaveLength(0); // No data on that page
    });

    it('should reject limit exceeding maxLimit', async () => {
      // Limit exceeding maxLimit should be rejected by DTO validation
      const response = await request(app.getHttpServer())
        .get('/api/movies?page=1&limit=1000')
        .expect(400);

      expect(response.body.success).toBe(false);
      // DTO validation rejects limit > 100, or service validation rejects it
      expect(response.body.message).toMatch(/limit|maximum|must not be greater/i);
    });

    it('should accept limit at maxLimit', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/movies?page=1&limit=100')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.meta.limit).toBeLessThanOrEqual(100);
    });

    it('should use default pagination when not provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/movies')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.limit).toBe(10);
    });
  });

  describe('Edge Cases - Business Logic', () => {
    it('should prevent duplicate scene numbers for same movie', async () => {
      // Create first scene with unique scene number
      const timestamp = Date.now();
      const firstSceneResponse = await request(app.getHttpServer())
        .post('/api/scenes')
        .send({
          movieId: movieId,
          title: `Scene ${timestamp}`,
          sceneNumber: timestamp % 1000, // Use unique scene number
          startTime: 0,
          endTime: 180,
        })
        .expect(201);

      const firstSceneId = firstSceneResponse.body.data.id;

      // Try to create duplicate scene number
      await request(app.getHttpServer())
        .post('/api/scenes')
        .send({
          movieId: movieId,
          title: `Scene Duplicate ${timestamp}`,
          sceneNumber: timestamp % 1000, // Same scene number
          startTime: 0,
          endTime: 180,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toContain('duplicate');
        });

      // Cleanup
      await dataSource.getRepository(Scene).delete({ id: firstSceneId });
    });

    it('should handle multiple licensing status updates correctly', async () => {
      // Ensure we have valid sceneId and songId from the workflow test
      if (!sceneId || !songId) {
        // Create them if they don't exist
        const movieResp = await request(app.getHttpServer())
          .post('/api/movies')
          .send({
            title: `Test Movie ${Date.now()}`,
            releaseYear: 2024,
          })
          .expect(201);
        const tempMovieId = movieResp.body.data.id;

        const sceneResp = await request(app.getHttpServer())
          .post('/api/scenes')
          .send({
            movieId: tempMovieId,
            title: 'Test Scene',
            sceneNumber: 999,
            startTime: 0,
            endTime: 180,
          })
          .expect(201);
        sceneId = sceneResp.body.data.id;

        const songResp = await request(app.getHttpServer())
          .post('/api/songs')
          .send({
            title: `Test Song ${Date.now()}`,
            artist: 'Artist',
            album: 'Album',
            genre: 'Rock',
            duration: 180,
            rightsHolder: 'Records',
          })
          .expect(201);
        songId = songResp.body.data.id;
      }

      // Create a new track for this test
      const trackResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          sceneId: sceneId,
          songId: songId,
          startTime: 0,
          endTime: 180,
        })
        .expect(201);

      const testTrackId = trackResponse.body.data.id;

      // Update through multiple statuses
      await request(app.getHttpServer())
        .patch(`/api/tracks/${testTrackId}/licensing-status`)
        .send({
          status: LicensingState.NEGOTIATING,
          notes: 'Step 1',
          updatedBy: 'test-user',
        })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/tracks/${testTrackId}/licensing-status`)
        .send({
          status: LicensingState.APPROVED,
          notes: 'Step 2',
          updatedBy: 'test-user',
        })
        .expect(200);

      // Verify history
      const track = await request(app.getHttpServer())
        .get(`/api/tracks/${testTrackId}`)
        .expect(200);

      expect(track.body.data.licensingStatusHistory).toHaveLength(3);
      expect(track.body.data.currentLicensingStatus).toBe(
        LicensingState.APPROVED,
      );

      // Cleanup
      await dataSource.getRepository(Track).delete({ id: testTrackId });
    });
  });

  describe('Edge Cases - Error Handling', () => {
    it('should return 404 for non-existent resources', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';
      await request(app.getHttpServer())
        .get(`/api/movies/${fakeId}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.statusCode).toBe(404);
        });
    });

    it('should return 400 for invalid update operations', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';
      await request(app.getHttpServer())
        .patch(`/api/movies/${fakeId}`)
        .send({
          title: 'Updated',
        })
        .expect(404);
    });

    it('should handle malformed JSON gracefully', async () => {
      await request(app.getHttpServer())
        .post('/api/movies')
        .set('Content-Type', 'application/json')
        .send('{"title": "Test", invalid json}')
        .expect(400);
    });
  });
});
