import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '../src/common/constants/api.constants';
import { getApp, closeApp } from './setup.e2e';

describe('Pagination (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getApp();
    // Create multiple movies for pagination testing
    for (let i = 0; i < 15; i++) {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/movies`)
        .send({
          title: `Pagination Test Movie ${i + 1}`,
          description: `Movie ${i + 1} for pagination testing`,
        });
    }
  });

  afterAll(async () => {
    await closeApp();
  });

  it('GET /api/movies should respect pagination parameters', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/movies`)
      .query({ page: 1, limit: 5 })
      .expect(200)
      .expect((res) => {
        expect(res.body.pagination).toHaveProperty('pageSize', 5);
        expect(res.body.pagination).toHaveProperty('hasNextPage');
        expect(res.body.pagination).toHaveProperty('hasPreviousPage');
        expect(res.body.data.length).toBeLessThanOrEqual(5);
      });
  });

  it('GET /api/movies should handle page 2', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/movies`)
      .query({ page: 2, limit: 5 })
      .expect(200)
      .expect((res) => {
        expect(res.body.pagination).toHaveProperty('pageSize', 5);
        expect(res.body.pagination).toHaveProperty('hasNextPage');
        expect(res.body.pagination).toHaveProperty('hasPreviousPage');
      });
  });
});
