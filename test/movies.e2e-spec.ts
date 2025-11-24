/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Movies E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let createdMovieId: string;

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

  describe('POST /api/movies', () => {
    it('should create a new movie', () => {
      return request(app.getHttpServer())
        .post('/api/movies')
        .send({
          title: 'Inception',
          description: 'A mind-bending thriller',
          releaseYear: 2010,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe('Inception');
          expect(res.body.description).toBe('A mind-bending thriller');
          expect(res.body.releaseYear).toBe(2010);
          expect(res.body).toHaveProperty('createdAt');
          expect(res.body).toHaveProperty('updatedAt');

          // Guardar el ID para tests posteriores
          createdMovieId = res.body.id;
        });
    });

    it('should fail with missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/movies')
        .send({
          description: 'Missing title and year',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          expect(res.body.message.length).toBeGreaterThan(0);
          // Verifica que haya errores relacionados con campos faltantes
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/title|Title/);
          expect(messages).toMatch(/releaseYear|number/);
        });
    });

    it('should fail with invalid year range', () => {
      return request(app.getHttpServer())
        .post('/api/movies')
        .send({
          title: 'Ancient Movie',
          releaseYear: 1500,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/1800/);
        });
    });

    it('should fail with non-whitelisted fields', () => {
      return request(app.getHttpServer())
        .post('/api/movies')
        .send({
          title: 'Test Movie',
          releaseYear: 2020,
          hackerField: 'malicious',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/hackerField/);
        });
    });

    it('should create movie without optional description', () => {
      return request(app.getHttpServer())
        .post('/api/movies')
        .send({
          title: 'The Matrix',
          releaseYear: 1999,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe('The Matrix');
          expect(res.body.releaseYear).toBe(1999);
        });
    });
  });

  describe('GET /api/movies', () => {
    it('should return array of movies', () => {
      return request(app.getHttpServer())
        .get('/api/movies')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('title');
          expect(res.body[0]).toHaveProperty('releaseYear');
          expect(res.body[0]).toHaveProperty('scenes');
        });
    });
  });

  describe('GET /api/movies/:id', () => {
    it('should return a single movie by id', () => {
      return request(app.getHttpServer())
        .get(`/api/movies/${createdMovieId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdMovieId);
          expect(res.body.title).toBe('Inception');
          expect(res.body).toHaveProperty('scenes');
        });
    });

    it('should return empty object for non-existent movie', () => {
      return request(app.getHttpServer())
        .get('/api/movies/00000000-0000-0000-0000-000000000000')
        .expect(404)
        .expect((res) => {
          expect(res.body.statusCode).toBe(404);
          expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('PATCH /api/movies/:id', () => {
    it('should update a movie', () => {
      return request(app.getHttpServer())
        .patch(`/api/movies/${createdMovieId}`)
        .send({
          title: 'Inception Updated',
          description: 'An updated description',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdMovieId);
          expect(res.body.title).toBe('Inception Updated');
          expect(res.body.description).toBe('An updated description');
          expect(res.body.releaseYear).toBe(2010); // No cambió
          expect(res.body.updatedAt).not.toBe(res.body.createdAt);
        });
    });

    it('should update only title', () => {
      return request(app.getHttpServer())
        .patch(`/api/movies/${createdMovieId}`)
        .send({
          title: 'Inception Final',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.title).toBe('Inception Final');
          expect(res.body.description).toBe('An updated description'); // Se mantiene
        });
    });

    it('should fail with invalid data', () => {
      return request(app.getHttpServer())
        .patch(`/api/movies/${createdMovieId}`)
        .send({
          releaseYear: 1000,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/1800/);
        });
    });

    it('should fail with non-whitelisted fields', () => {
      return request(app.getHttpServer())
        .patch(`/api/movies/${createdMovieId}`)
        .send({
          title: 'Valid Title',
          evilField: 'injection',
        })
        .expect(400);
    });
  });

  describe('DELETE /api/movies/:id', () => {
    it('should delete a movie', async () => {
      // Primero crear una película para borrar
      const createResponse = await request(app.getHttpServer())
        .post('/api/movies')
        .send({
          title: 'Movie to Delete',
          releaseYear: 2020,
        })
        .expect(201);

      const movieIdToDelete = createResponse.body.id;

      // Borrar la película
      await request(app.getHttpServer())
        .delete(`/api/movies/${movieIdToDelete}`)
        .expect(200);

      // Verificar que ya no existe
      await request(app.getHttpServer())
        .get(`/api/movies/${movieIdToDelete}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.statusCode).toBe(404);
          expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
        });
    });

    it('should handle deletion of non-existent movie', () => {
      return request(app.getHttpServer())
        .delete('/api/movies/00000000-0000-0000-0000-000000000000')
        .expect(404)
        .expect((res) => {
          expect(res.body.statusCode).toBe(404);
          expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('Integration: Complete CRUD flow', () => {
    it('should create, read, update, and delete a movie', async () => {
      // CREATE
      const createRes = await request(app.getHttpServer())
        .post('/api/movies')
        .send({
          title: 'CRUD Test Movie',
          description: 'Testing full CRUD',
          releaseYear: 2024,
        })
        .expect(201);

      const movieId = createRes.body.id;
      expect(movieId).toBeDefined();

      // READ
      const readRes = await request(app.getHttpServer())
        .get(`/api/movies/${movieId}`)
        .expect(200);

      expect(readRes.body.title).toBe('CRUD Test Movie');

      // UPDATE
      const updateRes = await request(app.getHttpServer())
        .patch(`/api/movies/${movieId}`)
        .send({
          title: 'CRUD Test Movie Updated',
        })
        .expect(200);

      expect(updateRes.body.title).toBe('CRUD Test Movie Updated');

      // DELETE
      await request(app.getHttpServer())
        .delete(`/api/movies/${movieId}`)
        .expect(200);

      // Verificar que fue borrado
      const deletedRes = await request(app.getHttpServer())
        .get(`/api/movies/${movieId}`)
        .expect(404);

      expect(deletedRes.body.statusCode).toBe(404);
      expect(deletedRes.body.code).toBe('RESOURCE_NOT_FOUND');
      expect(deletedRes.body).toHaveProperty('message');
      expect(deletedRes.body).toHaveProperty('timestamp');
    });
  });
});
