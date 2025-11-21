/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Songs E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let createdSongId: string;

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

  describe('POST /api/songs', () => {
    it('should create a new song', () => {
      return request(app.getHttpServer())
        .post('/api/songs')
        .send({
          title: 'Test Song',
          artist: 'Test Artist',
          durationSeconds: 180,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe('Test Song');
          expect(res.body.artist).toBe('Test Artist');
          expect(res.body.durationSeconds).toBe(180);
          expect(res.body).toHaveProperty('createdAt');
          expect(res.body).toHaveProperty('updatedAt');

          // Guardar el ID para tests posteriores
          createdSongId = res.body.id;
        });
    });

    it('should fail with missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/songs')
        .send({
          title: 'Missing Artist and Duration',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          expect(res.body.message.length).toBeGreaterThan(0);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/artist|Artist|durationSeconds|duration/i);
        });
    });

    it('should fail with invalid duration', () => {
      return request(app.getHttpServer())
        .post('/api/songs')
        .send({
          title: 'Short Song',
          artist: 'Test Artist',
          durationSeconds: 0,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/duration|1/i);
        });
    });

    it('should create song without optional fields', () => {
      return request(app.getHttpServer())
        .post('/api/songs')
        .send({
          title: 'Simple Song',
          artist: 'Simple Artist',
          durationSeconds: 120,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe('Simple Song');
          expect(res.body.artist).toBe('Simple Artist');
        });
    });

    it('should fail with non-whitelisted fields', () => {
      return request(app.getHttpServer())
        .post('/api/songs')
        .send({
          title: 'Test Song',
          artist: 'Test Artist',
          durationSeconds: 180,
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

  describe('GET /api/songs', () => {
    it('should return array of songs', () => {
      return request(app.getHttpServer())
        .get('/api/songs')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('title');
          expect(res.body[0]).toHaveProperty('artist');
          expect(res.body[0]).toHaveProperty('durationSeconds');
        });
    });
  });

  describe('GET /api/songs/:id', () => {
    it('should return a single song by id', () => {
      return request(app.getHttpServer())
        .get(`/api/songs/${createdSongId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdSongId);
          expect(res.body.title).toBe('Test Song');
          expect(res.body).toHaveProperty('tracks');
        });
    });

    it('should return empty object for non-existent song', () => {
      return request(app.getHttpServer())
        .get('/api/songs/00000000-0000-0000-0000-000000000000')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });
  });

  describe('PATCH /api/songs/:id', () => {
    it('should update a song', () => {
      return request(app.getHttpServer())
        .patch(`/api/songs/${createdSongId}`)
        .send({
          title: 'Test Song Updated',
          artist: 'Updated Artist',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdSongId);
          expect(res.body.title).toBe('Test Song Updated');
          expect(res.body.artist).toBe('Updated Artist');
          expect(res.body.durationSeconds).toBe(180); // No cambió
          expect(res.body.updatedAt).not.toBe(res.body.createdAt);
        });
    });

    it('should update only title', () => {
      return request(app.getHttpServer())
        .patch(`/api/songs/${createdSongId}`)
        .send({
          title: 'Test Song Final',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.title).toBe('Test Song Final');
          expect(res.body.artist).toBe('Updated Artist'); // Se mantiene
        });
    });

    it('should fail with invalid duration', () => {
      return request(app.getHttpServer())
        .patch(`/api/songs/${createdSongId}`)
        .send({
          durationSeconds: 0,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/duration|1/i);
        });
    });

    it('should fail with non-whitelisted fields', () => {
      return request(app.getHttpServer())
        .patch(`/api/songs/${createdSongId}`)
        .send({
          title: 'Valid Title',
          evilField: 'injection',
        })
        .expect(400);
    });
  });

  describe('DELETE /api/songs/:id', () => {
    it('should delete a song', async () => {
      // Primero crear una canción para borrar
      const createResponse = await request(app.getHttpServer())
        .post('/api/songs')
        .send({
          title: 'Song to Delete',
          artist: 'Artist to Delete',
          durationSeconds: 200,
        })
        .expect(201);

      const songIdToDelete = createResponse.body.id;

      // Borrar la canción
      await request(app.getHttpServer())
        .delete(`/api/songs/${songIdToDelete}`)
        .expect(200);

      // Verificar que ya no existe
      await request(app.getHttpServer())
        .get(`/api/songs/${songIdToDelete}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should handle deletion of non-existent song', () => {
      return request(app.getHttpServer())
        .delete('/api/songs/00000000-0000-0000-0000-000000000000')
        .expect(200);
    });
  });

  describe('Integration: Complete CRUD flow for songs', () => {
    it('should create, read, update, and delete a song', async () => {
      // CREATE
      const createRes = await request(app.getHttpServer())
        .post('/api/songs')
        .send({
          title: 'CRUD Test Song',
          artist: 'CRUD Artist',
          durationSeconds: 240,
        })
        .expect(201);

      const songId = createRes.body.id;
      expect(songId).toBeDefined();

      // READ
      const readRes = await request(app.getHttpServer())
        .get(`/api/songs/${songId}`)
        .expect(200);

      expect(readRes.body.title).toBe('CRUD Test Song');

      // UPDATE
      const updateRes = await request(app.getHttpServer())
        .patch(`/api/songs/${songId}`)
        .send({
          title: 'CRUD Test Song Updated',
        })
        .expect(200);

      expect(updateRes.body.title).toBe('CRUD Test Song Updated');

      // DELETE
      await request(app.getHttpServer())
        .delete(`/api/songs/${songId}`)
        .expect(200);

      // Verificar que fue borrado
      const deletedRes = await request(app.getHttpServer())
        .get(`/api/songs/${songId}`)
        .expect(200);

      expect(deletedRes.body).toEqual({});
    });
  });
});
