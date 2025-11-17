import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '../src/common/constants/api.constants';
import { getApp, closeApp } from './setup.e2e';

describe('Error Handling (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getApp();
  });

  afterAll(async () => {
    await closeApp();
  });

  it('GET /api/movies/:id should return 404 for deleted movie', async () => {
    // Create a movie
    const createResponse = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/movies`)
      .send({
        title: 'Movie to Delete',
        description: 'This movie will be deleted',
      });
    const movieId = createResponse.body.id;

    // Delete the movie (soft delete)
    await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/movies/${movieId}`)
      .expect(200);

    // Try to get the deleted movie
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/movies/${movieId}`)
      .expect(404);
  });

  it('GET /api/tracks/:id should return 404 for non-existent track', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/tracks/99999`)
      .expect(404);
  });

  it('PUT /api/tracks/:id/license/status should return 404 for non-existent track', () => {
    return request(app.getHttpServer())
      .put(`/${API_PREFIX}/tracks/99999/license/status`)
      .send({
        status: 2,
      })
      .expect(404);
  });
});

