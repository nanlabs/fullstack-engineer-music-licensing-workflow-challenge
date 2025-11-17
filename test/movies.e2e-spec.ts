import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '../src/common/constants/api.constants';
import { getApp, closeApp } from './setup.e2e';

describe('Movies (e2e)', () => {
  let app: INestApplication;
  let movieId: number;

  beforeAll(async () => {
    app = await getApp();
  });

  afterAll(async () => {
    await closeApp();
  });

  it('POST /api/movies should create a movie', () => {
    return request(app.getHttpServer())
      .post(`/${API_PREFIX}/movies`)
      .send({
        title: 'Test Movie',
        description: 'A test movie for E2E testing',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('title', 'Test Movie');
        expect(res.body).toHaveProperty(
          'description',
          'A test movie for E2E testing',
        );
        movieId = res.body.id;
      });
  });

  it('GET /api/movies should return paginated movies', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/movies`)
      .query({ page: 1, limit: 10 })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.pagination).toHaveProperty('hasNextPage');
        expect(res.body.pagination).toHaveProperty('hasPreviousPage');
        expect(res.body.pagination).toHaveProperty('pageSize', 10);
      });
  });

  it('GET /api/movies/:id should return a movie by id', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/movies/${movieId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('id', movieId);
        expect(res.body).toHaveProperty('title', 'Test Movie');
      });
  });

  it('PUT /api/movies/:id should update a movie', async () => {
    const response = await request(app.getHttpServer())
      .put(`/${API_PREFIX}/movies/${movieId}`)
      .send({
        title: 'Updated Test Movie',
      })
      .expect(200);

    // The API returns the updated movie entity
    expect(response.body).toHaveProperty('id', movieId);
    expect(response.body).toHaveProperty('title', 'Updated Test Movie');

    // Verify the update by fetching the movie again
    const getResponse = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/movies/${movieId}`)
      .expect(200);

    expect(getResponse.body).toHaveProperty('id', movieId);
    expect(getResponse.body).toHaveProperty('title', 'Updated Test Movie');
  });

  it('GET /api/movies/:id should return 404 for non-existent movie', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/movies/99999`)
      .expect(404);
  });

  it('POST /api/movies should return 400 for invalid data', () => {
    return request(app.getHttpServer())
      .post(`/${API_PREFIX}/movies`)
      .send({
        title: '', // Invalid: empty title
      })
      .expect(400);
  });
});

