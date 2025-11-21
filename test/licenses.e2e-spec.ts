/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { LicenseStatus } from '../src/entities';

describe('Licenses E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let createdMovieId: string;
  let createdSceneId: string;
  let createdSongId: string;
  let createdLicenseId: string;

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

    // Crear una película para usar en los tests de licenses
    const movieResponse = await request(app.getHttpServer())
      .post('/api/movies')
      .send({
        title: 'Test Movie for Licenses',
        description: 'A test movie',
        releaseYear: 2020,
      })
      .expect(201);

    createdMovieId = movieResponse.body.id;
    expect(createdMovieId).toBeDefined();

    // Crear una escena para usar en los tests de licenses
    const sceneResponse = await request(app.getHttpServer())
      .post('/api/scenes')
      .send({
        name: 'Test Scene for Licenses',
        description: 'A test scene',
        sceneNumber: 1,
        movieId: createdMovieId,
      })
      .expect(201);

    createdSceneId = sceneResponse.body.id;
    expect(createdSceneId).toBeDefined();

    // Crear una canción para usar en los tests de licenses
    const songResponse = await request(app.getHttpServer())
      .post('/api/songs')
      .send({
        title: 'Test Song for Licenses',
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

  describe('POST /api/licenses', () => {
    it('should create a new license', async () => {
      // Crear un nuevo track para esta prueba
      const trackResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Track for License 1',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 60,
          endTimeSeconds: 120,
        })
        .expect(201);

      const trackId = trackResponse.body.id;

      return request(app.getHttpServer())
        .post('/api/licenses')
        .send({
          trackId: trackId,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.trackId).toBe(trackId);
          expect(res.body.status).toBe(LicenseStatus.PENDING);
          expect(res.body).toHaveProperty('createdAt');
          expect(res.body).toHaveProperty('updatedAt');

          // Guardar el ID para tests posteriores
          createdLicenseId = res.body.id;
        });
    });

    it('should create a license with initial status', async () => {
      // Crear un nuevo track para esta prueba
      const trackResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Track for License 2',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 120,
          endTimeSeconds: 180,
        })
        .expect(201);

      const trackId = trackResponse.body.id;

      return request(app.getHttpServer())
        .post('/api/licenses')
        .send({
          trackId: trackId,
          status: LicenseStatus.NEGOTIATING,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.trackId).toBe(trackId);
          expect(res.body.status).toBe(LicenseStatus.NEGOTIATING);
        });
    });

    it('should create a license with notes', async () => {
      // Crear un nuevo track para esta prueba
      const trackResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Track for License 3',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 180,
          endTimeSeconds: 240,
        })
        .expect(201);

      const trackId = trackResponse.body.id;

      return request(app.getHttpServer())
        .post('/api/licenses')
        .send({
          trackId: trackId,
          notes: 'Test notes for license',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.notes).toBe('Test notes for license');
        });
    });

    it('should fail with missing trackId', () => {
      return request(app.getHttpServer())
        .post('/api/licenses')
        .send({
          status: LicenseStatus.PENDING,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          expect(res.body.message.length).toBeGreaterThan(0);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/trackId|track/i);
        });
    });

    it('should fail with invalid trackId format', () => {
      return request(app.getHttpServer())
        .post('/api/licenses')
        .send({
          trackId: 'not-a-uuid',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/uuid|UUID/i);
        });
    });

    it('should fail with invalid status enum', async () => {
      // Crear un track para esta prueba de validación
      const trackResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Track for Validation Test 1',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 240,
          endTimeSeconds: 300,
        })
        .expect(201);

      return request(app.getHttpServer())
        .post('/api/licenses')
        .send({
          trackId: trackResponse.body.id,
          status: 'INVALID_STATUS',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/status|enum/i);
        });
    });

    it('should fail with non-whitelisted fields', async () => {
      // Crear un track para esta prueba de validación
      const trackResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Track for Validation Test 2',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 300,
          endTimeSeconds: 360,
        })
        .expect(201);

      return request(app.getHttpServer())
        .post('/api/licenses')
        .send({
          trackId: trackResponse.body.id,
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

  describe('GET /api/licenses', () => {
    it('should return array of licenses', () => {
      return request(app.getHttpServer())
        .get('/api/licenses')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('trackId');
          expect(res.body[0]).toHaveProperty('status');
          expect(res.body[0]).toHaveProperty('track');
        });
    });
  });

  describe('GET /api/licenses/:id', () => {
    it('should return a single license by id', () => {
      return request(app.getHttpServer())
        .get(`/api/licenses/${createdLicenseId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdLicenseId);
          expect(res.body.status).toBe(LicenseStatus.PENDING);
          expect(res.body).toHaveProperty('track');
          expect(res.body).toHaveProperty('trackId');
        });
    });

    it('should return empty object for non-existent license', () => {
      return request(app.getHttpServer())
        .get('/api/licenses/00000000-0000-0000-0000-000000000000')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });
  });

  describe('GET /api/licenses/track/:trackId', () => {
    it('should return license by trackId', async () => {
      // Crear un nuevo track con license para esta prueba
      const trackResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Track for License by Track ID',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 240,
          endTimeSeconds: 300,
        })
        .expect(201);

      const trackId = trackResponse.body.id;

      // Crear una license para este track
      await request(app.getHttpServer())
        .post('/api/licenses')
        .send({
          trackId: trackId,
        })
        .expect(201);

      // Ahora obtener la license por trackId
      return request(app.getHttpServer())
        .get(`/api/licenses/track/${trackId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.trackId).toBe(trackId);
          expect(res.body).toHaveProperty('track');
        });
    });

    it('should return empty object for track with no license', () => {
      return request(app.getHttpServer())
        .get('/api/licenses/track/00000000-0000-0000-0000-000000000000')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });
  });

  describe('PATCH /api/licenses/:id/status', () => {
    it('should update license status from PENDING to NEGOTIATING', () => {
      return request(app.getHttpServer())
        .patch(`/api/licenses/${createdLicenseId}/status`)
        .send({
          status: LicenseStatus.NEGOTIATING,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdLicenseId);
          expect(res.body.status).toBe(LicenseStatus.NEGOTIATING);
          expect(res.body.updatedAt).not.toBe(res.body.createdAt);
        });
    });

    it('should update license status with notes', () => {
      return request(app.getHttpServer())
        .patch(`/api/licenses/${createdLicenseId}/status`)
        .send({
          status: LicenseStatus.APPROVED,
          notes: 'License approved with conditions',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(LicenseStatus.APPROVED);
          expect(res.body.notes).toBe('License approved with conditions');
        });
    });

    it('should reject invalid state transitions', () => {
      // Try to move from APPROVED directly to NEGOTIATING (invalid)
      return request(app.getHttpServer())
        .patch(`/api/licenses/${createdLicenseId}/status`)
        .send({
          status: LicenseStatus.NEGOTIATING,
        })
        .expect(500); // Should return error due to invalid transition
    });

    it('should fail with invalid status enum', () => {
      return request(app.getHttpServer())
        .patch(`/api/licenses/${createdLicenseId}/status`)
        .send({
          status: 'INVALID_STATUS',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBeInstanceOf(Array);
          const messages = res.body.message.join(' ');
          expect(messages).toMatch(/status|enum/i);
        });
    });

    it('should fail with non-whitelisted fields', () => {
      return request(app.getHttpServer())
        .patch(`/api/licenses/${createdLicenseId}/status`)
        .send({
          status: LicenseStatus.PENDING,
          evilField: 'injection',
        })
        .expect(400);
    });
  });

  describe('DELETE /api/licenses/:id', () => {
    it('should delete a license', async () => {
      // Crear un nuevo track y license para borrar
      const trackResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Track to Delete',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 120,
          endTimeSeconds: 180,
        })
        .expect(201);

      const trackIdToDelete = trackResponse.body.id;

      const licenseResponse = await request(app.getHttpServer())
        .post('/api/licenses')
        .send({
          trackId: trackIdToDelete,
        })
        .expect(201);

      const licenseIdToDelete = licenseResponse.body.id;

      // Borrar la license
      await request(app.getHttpServer())
        .delete(`/api/licenses/${licenseIdToDelete}`)
        .expect(200);

      // Verificar que ya no existe
      await request(app.getHttpServer())
        .get(`/api/licenses/${licenseIdToDelete}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({});
        });
    });

    it('should handle deletion of non-existent license', () => {
      return request(app.getHttpServer())
        .delete('/api/licenses/00000000-0000-0000-0000-000000000000')
        .expect(200);
    });
  });

  describe('Integration: Complete CRUD flow for licenses', () => {
    it('should create, read, update, and delete a license', async () => {
      // Crear un nuevo track para este test
      const trackResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'CRUD Test Track',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 60,
          endTimeSeconds: 120,
        })
        .expect(201);

      const testTrackId = trackResponse.body.id;

      // CREATE
      const createRes = await request(app.getHttpServer())
        .post('/api/licenses')
        .send({
          trackId: testTrackId,
          notes: 'CRUD Test License',
        })
        .expect(201);

      const licenseId = createRes.body.id;
      expect(licenseId).toBeDefined();
      expect(createRes.body.status).toBe(LicenseStatus.PENDING);

      // READ
      const readRes = await request(app.getHttpServer())
        .get(`/api/licenses/${licenseId}`)
        .expect(200);

      expect(readRes.body.trackId).toBe(testTrackId);
      expect(readRes.body.status).toBe(LicenseStatus.PENDING);

      // UPDATE - Change status to NEGOTIATING
      const updateRes = await request(app.getHttpServer())
        .patch(`/api/licenses/${licenseId}/status`)
        .send({
          status: LicenseStatus.NEGOTIATING,
          notes: 'Updated notes',
        })
        .expect(200);

      expect(updateRes.body.status).toBe(LicenseStatus.NEGOTIATING);
      expect(updateRes.body.notes).toBe('Updated notes');

      // DELETE
      await request(app.getHttpServer())
        .delete(`/api/licenses/${licenseId}`)
        .expect(200);

      // Verificar que fue borrado
      const deletedRes = await request(app.getHttpServer())
        .get(`/api/licenses/${licenseId}`)
        .expect(200);

      expect(deletedRes.body).toEqual({});
    });

    it('should test valid license status transitions', async () => {
      // Crear un nuevo track
      const trackResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Status Transition Test Track',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 180,
          endTimeSeconds: 240,
        })
        .expect(201);

      const testTrackId = trackResponse.body.id;

      // CREATE
      const createRes = await request(app.getHttpServer())
        .post('/api/licenses')
        .send({
          trackId: testTrackId,
        })
        .expect(201);

      const licenseId = createRes.body.id;

      // PENDING -> NEGOTIATING (valid)
      const negotiatingRes = await request(app.getHttpServer())
        .patch(`/api/licenses/${licenseId}/status`)
        .send({
          status: LicenseStatus.NEGOTIATING,
        })
        .expect(200);

      expect(negotiatingRes.body.status).toBe(LicenseStatus.NEGOTIATING);

      // NEGOTIATING -> APPROVED (valid)
      const approvedRes = await request(app.getHttpServer())
        .patch(`/api/licenses/${licenseId}/status`)
        .send({
          status: LicenseStatus.APPROVED,
        })
        .expect(200);

      expect(approvedRes.body.status).toBe(LicenseStatus.APPROVED);

      // Try APPROVED -> REJECTED (invalid - should fail)
      await request(app.getHttpServer())
        .patch(`/api/licenses/${licenseId}/status`)
        .send({
          status: LicenseStatus.REJECTED,
        })
        .expect(500);
    });

    it('should fetch license by track and verify relationships', async () => {
      // Crear un nuevo track con license para esta prueba
      const trackResponse = await request(app.getHttpServer())
        .post('/api/tracks')
        .send({
          name: 'Track for Relationship Test',
          sceneId: createdSceneId,
          songId: createdSongId,
          startTimeSeconds: 300,
          endTimeSeconds: 360,
        })
        .expect(201);

      const trackId = trackResponse.body.id;

      // Crear una license para este track
      await request(app.getHttpServer())
        .post('/api/licenses')
        .send({
          trackId: trackId,
        })
        .expect(201);

      // Obtener license por trackId
      const licenseRes = await request(app.getHttpServer())
        .get(`/api/licenses/track/${trackId}`)
        .expect(200);

      expect(licenseRes.body).toHaveProperty('id');
      expect(licenseRes.body.trackId).toBe(trackId);

      // Obtener license completa y verificar relaciones
      const licenseId = licenseRes.body.id;
      const detailedRes = await request(app.getHttpServer())
        .get(`/api/licenses/${licenseId}`)
        .expect(200);

      expect(detailedRes.body.track).toBeDefined();
      expect(detailedRes.body.track.id).toBe(trackId);
      expect(detailedRes.body.track.song).toBeDefined();
      expect(detailedRes.body.track.scene).toBeDefined();
    });
  });
});
