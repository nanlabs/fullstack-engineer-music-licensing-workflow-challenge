import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '../src/common/constants/api.constants';
import { getApp, closeApp } from './setup.e2e';

describe('Health Check (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getApp();
  });

  afterAll(async () => {
    await closeApp();
  });

  it('GET /api/health should return ok', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/health`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
      });
  });
});

