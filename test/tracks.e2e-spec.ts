/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Tracks E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let createdMovieId: string;
  let createdSceneId: string;
  let createdSongId: string;
  let createdTrackId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Configurar ValidationPipe igual que en main.ts
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

    // Obtener DataSource para limpiar la BD después
    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Clean up any leftover test data before starting
    if (dataSource) {
      await dataSource.query('DELETE FROM licenses');
      await dataSource.query('DELETE FROM tracks');
      await dataSource.query('DELETE FROM scenes');
      await dataSource.query('DELETE FROM songs');
      await dataSource.query('DELETE FROM movies');
    }

    // Crear una película para usar en los tests de tracks
    const movieResponse = await request(app.getHttpServer())
      .post('/api/movies')
      .send({
        title: 'Test Movie for Tracks',
        description: 'A test movie',
        releaseYear: 2020,
      })
      .expect(201);

    createdMovieId = movieResponse.body.id;
    expect(createdMovieId).toBeDefined();

    // Crear una escena para usar en los tests de tracks
    const sceneResponse = await request(app.getHttpServer())
      .post('/api/scenes')
      .send({
        name: 'Test Scene for Tracks',
        description: 'A test scene',
        sceneNumber: 1,
        movieId: createdMovieId,
      })
      .expect(201);

    createdSceneId = sceneResponse.body.id;
    expect(createdSceneId).toBeDefined();

    // Crear una canción para usar en los tests de tracks
    const songResponse = await request(app.getHttpServer())
      .post('/api/songs')
      .send({
        title: 'Test Song for Tracks',
        artist: 'Test Artist',
        durationSeconds: 180,
      })
      .expect(201);

    createdSongId = songResponse.body.id;
    expect(createdSongId).toBeDefined();
  });

  afterAll(async () => {
    // Limpiar datos de test (eliminar en orden respetando foreign keys)
    if (dataSource) {
      await dataSource.query('DELETE FROM licenses');
      await dataSource.query('DELETE FROM tracks');
      await dataSource.query('DELETE FROM scenes');
      await dataSource.query('DELETE FROM songs');
      await dataSource.query('DELETE FROM movies');
    }
    await app.close();
  });

  describe('POST /api/tracks', () => {
    it('should create a new track', () => {
      return request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Opening Track',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 0,
          endTimeSeconds: 60,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Opening Track');
          expect(res.body.sceneId).toBe(createdSceneId);
          expect(res.body.songId).toBe(createdSongId);
          expect(res.body.startTimeSeconds).toBe(0);
          expect(res.body.endTimeSeconds).toBe(60);
          expect(res.body).toHaveProperty('createdAt');
          expect(res.body).toHaveProperty('updatedAt');

          // Guardar el ID para tests posteriores
          createdTrackId = res.body.id;
        });
    });

    it('should fail with missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          sceneId: createdSceneId,
          songId: createdSongId,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          expect(res.body.message.length).toBeGreaterThan(0);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/name|Name|startTimeSeconds|endTimeSeconds/);
        });
    });

    it('should create track with valid time range', () => {
      return request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Action Track',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 60,
          endTimeSeconds: 120,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Action Track');
          expect(res.body.startTimeSeconds).toBe(60);
          expect(res.body.endTimeSeconds).toBe(120);
        });
    });

    it('should fail with non-whitelisted fields', () => {
      return request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Test Track',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 0,
          endTimeSeconds: 60,
          maliciousField: 'injection',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/maliciousField/);
        });
    });
  });

  describe('GET /api/tracks', () => {
    it('should return array of tracks', () => {
      return request(app.getHttpServer())
        .get('/api/tracks')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('name');
          expect(res.body[0]).toHaveProperty('scene');
          expect(res.body[0]).toHaveProperty('song');
        });
    });
  });

  describe('GET /api/tracks/:id', () => {
    it('should return a single track by id', () => {
      return request(app.getHttpServer())
        .get(`/api/tracks/${createdTrackId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdTrackId);
          expect(res.body.name).toBe('Opening Track');
          expect(res.body).toHaveProperty('scene');
          expect(res.body).toHaveProperty('song');
        });
    });

    it('should return empty object for non-existent track', () => {
      return request(app.getHttpServer())
        .get('/api/tracks/00000000-0000-0000-0000-000000000000')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });
  });

  describe('GET /api/tracks/scene/:sceneId', () => {
    it('should return tracks filtered by sceneId', () => {
      return request(app.getHttpServer())
        .get(`/api/tracks/scene/${createdSceneId}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          // Todos deben tener el mismo sceneId
          res.body.forEach((track) => {
            expect(track.sceneId).toBe(createdSceneId);
          });
        });
    });

    it('should return empty array for scene with no tracks', () => {
      return request(app.getHttpServer())
        .get('/api/tracks/scene/00000000-0000-0000-0000-000000000000')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(0);
        });
    });
  });

  describe('PATCH /api/tracks/:id', () => {
    it('should update a track', () => {
      return request(app.getHttpServer())
        .patch(`/api/tracks/${createdTrackId}`)
        .send({
          name: 'Opening Track Updated',
          startTimeSeconds: 5,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdTrackId);
          expect(res.body.name).toBe('Opening Track Updated');
          expect(res.body.startTimeSeconds).toBe(5);
          expect(res.body.endTimeSeconds).toBe(60); // No cambió
          expect(res.body.updatedAt).not.toBe(res.body.createdAt);
        });
    });

    it('should update only track name', () => {
      return request(app.getHttpServer())
        .patch(`/api/tracks/${createdTrackId}`)
        .send({
          name: 'Opening Track Final',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Opening Track Final');
          expect(res.body.startTimeSeconds).toBe(5); // Se mantiene
        });
    });

    it('should fail with non-whitelisted fields', () => {
      return request(app.getHttpServer())
        .patch(`/api/tracks/${createdTrackId}`)
        .send({
          name: 'Valid Name',
          evilField: 'injection',
        })
        .expect(400);
    });
  });

  describe('DELETE /api/tracks/:id', () => {
    it('should delete a track', async () => {
      // Primero crear un track para borrar
      const createResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Track to Delete',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 120,
          endTimeSeconds: 180,
        })
        .expect(201);

      const trackIdToDelete = createResponse.body.id;

      // Borrar el track
      await request(app.getHttpServer())
        .delete(`/api/tracks/${trackIdToDelete}`)
        .expect(200);

      // Verificar que ya no existe
      await request(app.getHttpServer())
        .get(`/api/tracks/${trackIdToDelete}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should handle deletion of non-existent track', () => {
      return request(app.getHttpServer())
        .delete('/api/tracks/00000000-0000-0000-0000-000000000000')
        .expect(200);
    });
  });

  describe('Integration: Complete CRUD flow for tracks', () => {
    it('should create, read, update, and delete a track', async () => {
      // CREATE
      const createRes = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'CRUD Test Track',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 30,
          endTimeSeconds: 90,
        })
        .expect(201);

      const trackId = createRes.body.id;
      expect(trackId).toBeDefined();

      // READ
      const readRes = await request(app.getHttpServer())
        .get(`/api/tracks/${trackId}`)
        .expect(200);

      expect(readRes.body.name).toBe('CRUD Test Track');

      // UPDATE
      const updateRes = await request(app.getHttpServer())
        .patch(`/api/tracks/${trackId}`)
        .send({
          name: 'CRUD Test Track Updated',
        })
        .expect(200);

      expect(updateRes.body.name).toBe('CRUD Test Track Updated');

      // DELETE
      await request(app.getHttpServer())
        .delete(`/api/tracks/${trackId}`)
        .expect(200);

      // Verificar que fue borrado
      const deletedRes = await request(app.getHttpServer())
        .get(`/api/tracks/${trackId}`)
        .expect(200);

      expect(deletedRes.body).toEqual({});
    });

    it('should fetch tracks by scene and ensure relationships', async () => {
      // Obtener tracks de la escena
      const tracksRes = await request(app.getHttpServer())
        .get(`/api/tracks/scene/${createdSceneId}`)
        .expect(200);

      expect(Array.isArray(tracksRes.body)).toBe(true);
      expect(tracksRes.body.length).toBeGreaterThan(0);

      // Obtener un track específico y verificar relaciones
      const trackId = tracksRes.body[0].id;
      const trackRes = await request(app.getHttpServer())
        .get(`/api/tracks/${trackId}`)
        .expect(200);

      expect(trackRes.body.scene).toBeDefined();
      expect(trackRes.body.scene.id).toBe(createdSceneId);
      expect(trackRes.body.song).toBeDefined();
      expect(trackRes.body.song.id).toBe(createdSongId);
    });
  });
});
