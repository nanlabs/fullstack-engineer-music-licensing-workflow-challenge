/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Scenes E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let createdMovieId: string;
  let createdSceneId: string;

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

    // Crear una película para usar en los tests de scenes
    const movieResponse = await request(app.getHttpServer())
      .post('/api/movies')
      .send({
        title: 'Test Movie for Scenes',
        description: 'A test movie',
        releaseYear: 2020,
      })
      .expect(201);

    createdMovieId = movieResponse.body.id;
    expect(createdMovieId).toBeDefined();
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

  describe('POST /api/scenes', () => {
    it('should create a new scene', () => {
      return request(app.getHttpServer())
        .post('/api/scenes')
        .send({
          name: 'Opening Scene',
          description: 'The beginning of the film',
          sceneNumber: 1,
          movieId: createdMovieId,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Opening Scene');
          expect(res.body.description).toBe('The beginning of the film');
          expect(res.body.sceneNumber).toBe(1);
          expect(res.body.movieId).toBe(createdMovieId);
          expect(res.body).toHaveProperty('createdAt');
          expect(res.body).toHaveProperty('updatedAt');

          // Guardar el ID para tests posteriores
          createdSceneId = res.body.id;
        });
    });

    it('should fail with missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/scenes')
        .send({
          description: 'Missing name and sceneNumber',
          movieId: createdMovieId,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          expect(res.body.message.length).toBeGreaterThan(0);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/name|Name/);
          expect(messages).toMatch(/sceneNumber|number/);
        });
    });

    it('should create scene without optional description', () => {
      return request(app.getHttpServer())
        .post('/api/scenes')
        .send({
          name: 'Action Scene',
          sceneNumber: 5,
          movieId: createdMovieId,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Action Scene');
          expect(res.body.sceneNumber).toBe(5);
        });
    });

    it('should fail with non-whitelisted fields', () => {
      return request(app.getHttpServer())
        .post('/api/scenes')
        .send({
          name: 'Test Scene',
          sceneNumber: 2,
          movieId: createdMovieId,
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

  describe('GET /api/scenes', () => {
    it('should return array of scenes', () => {
      return request(app.getHttpServer())
        .get('/api/scenes')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('name');
          expect(res.body[0]).toHaveProperty('sceneNumber');
          expect(res.body[0]).toHaveProperty('movie');
          expect(res.body[0]).toHaveProperty('tracks');
        });
    });
  });

  describe('GET /api/scenes/:id', () => {
    it('should return a single scene by id', () => {
      return request(app.getHttpServer())
        .get(`/api/scenes/${createdSceneId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdSceneId);
          expect(res.body.name).toBe('Opening Scene');
          expect(res.body).toHaveProperty('movie');
          expect(res.body).toHaveProperty('tracks');
        });
    });

    it('should return empty object for non-existent scene', () => {
      return request(app.getHttpServer())
        .get('/api/scenes/00000000-0000-0000-0000-000000000000')
        .expect(404)
        .expect((res) => {
          expect(res.body.statusCode).toBe(404);
          expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('GET /api/scenes/movie/:movieId', () => {
    it('should return scenes filtered by movieId', () => {
      return request(app.getHttpServer())
        .get(`/api/scenes/movie/${createdMovieId}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          // Todos deben tener el mismo movieId
          res.body.forEach((scene) => {
            expect(scene.movieId).toBe(createdMovieId);
          });
        });
    });

    it('should return empty array for movie with no scenes', () => {
      return request(app.getHttpServer())
        .get('/api/scenes/movie/00000000-0000-0000-0000-000000000000')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(0);
        });
    });
  });

  describe('PATCH /api/scenes/:id', () => {
    it('should update a scene', () => {
      return request(app.getHttpServer())
        .patch(`/api/scenes/${createdSceneId}`)
        .send({
          name: 'Opening Scene Updated',
          description: 'An updated description',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdSceneId);
          expect(res.body.name).toBe('Opening Scene Updated');
          expect(res.body.description).toBe('An updated description');
          expect(res.body.sceneNumber).toBe(1); // No cambió
          expect(res.body.updatedAt).not.toBe(res.body.createdAt);
        });
    });

    it('should update only scene name', () => {
      return request(app.getHttpServer())
        .patch(`/api/scenes/${createdSceneId}`)
        .send({
          name: 'Opening Scene Final',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Opening Scene Final');
          expect(res.body.description).toBe('An updated description'); // Se mantiene
        });
    });

    it('should fail with non-whitelisted fields', () => {
      return request(app.getHttpServer())
        .patch(`/api/scenes/${createdSceneId}`)
        .send({
          name: 'Valid Name',
          evilField: 'injection',
        })
        .expect(400);
    });
  });

  describe('DELETE /api/scenes/:id', () => {
    it('should delete a scene', async () => {
      // Primero crear una escena para borrar
      const createResponse = await request(app.getHttpServer())
        .post('/api/scenes')
        .send({
          name: 'Scene to Delete',
          sceneNumber: 10,
          movieId: createdMovieId,
        })
        .expect(201);

      const sceneIdToDelete = createResponse.body.id;

      // Borrar la escena
      await request(app.getHttpServer())
        .delete(`/api/scenes/${sceneIdToDelete}`)
        .expect(200);

      // Verificar que ya no existe
      await request(app.getHttpServer())
        .get(`/api/scenes/${sceneIdToDelete}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.statusCode).toBe(404);
          expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
        });
    });

    it('should handle deletion of non-existent scene', () => {
      return request(app.getHttpServer())
        .delete('/api/scenes/00000000-0000-0000-0000-000000000000')
        .expect(404)
        .expect((res) => {
          expect(res.body.statusCode).toBe(404);
          expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('Integration: Complete CRUD flow for scenes', () => {
    it('should create, read, update, and delete a scene', async () => {
      // CREATE
      const createRes = await request(app.getHttpServer())
        .post('/api/scenes')
        .send({
          name: 'CRUD Test Scene',
          description: 'Testing full CRUD',
          sceneNumber: 99,
          movieId: createdMovieId,
        })
        .expect(201);

      const sceneId = createRes.body.id;
      expect(sceneId).toBeDefined();

      // READ
      const readRes = await request(app.getHttpServer())
        .get(`/api/scenes/${sceneId}`)
        .expect(200);

      expect(readRes.body.name).toBe('CRUD Test Scene');

      // UPDATE
      const updateRes = await request(app.getHttpServer())
        .patch(`/api/scenes/${sceneId}`)
        .send({
          name: 'CRUD Test Scene Updated',
        })
        .expect(200);

      expect(updateRes.body.name).toBe('CRUD Test Scene Updated');

      // DELETE
      await request(app.getHttpServer())
        .delete(`/api/scenes/${sceneId}`)
        .expect(200);

      // Verificar que fue borrado
      const deletedRes = await request(app.getHttpServer())
        .get(`/api/scenes/${sceneId}`)
        .expect(404);

      expect(deletedRes.body.statusCode).toBe(404);
      expect(deletedRes.body.code).toBe('RESOURCE_NOT_FOUND');
      expect(deletedRes.body).toHaveProperty('message');
      expect(deletedRes.body).toHaveProperty('timestamp');
    });

    it('should fetch scenes by movie and ensure relationships', async () => {
      // Obtener escenas de la película
      const scenesRes = await request(app.getHttpServer())
        .get(`/api/scenes/movie/${createdMovieId}`)
        .expect(200);

      expect(Array.isArray(scenesRes.body)).toBe(true);
      expect(scenesRes.body.length).toBeGreaterThan(0);

      // Obtener una escena específica y verificar relaciones
      const sceneId = scenesRes.body[0].id;
      const sceneRes = await request(app.getHttpServer())
        .get(`/api/scenes/${sceneId}`)
        .expect(200);

      expect(sceneRes.body.movie).toBeDefined();
      expect(sceneRes.body.movie.id).toBe(createdMovieId);
      expect(sceneRes.body.tracks).toBeDefined();
    });
  });
});
