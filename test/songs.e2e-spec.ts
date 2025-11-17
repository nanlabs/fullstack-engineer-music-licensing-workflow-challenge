import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '../src/common/constants/api.constants';
import { getApp, closeApp } from './setup.e2e';

describe('Songs (e2e)', () => {
  let app: INestApplication;
  let songId: number;

  beforeAll(async () => {
    app = await getApp();
  });

  afterAll(async () => {
    await closeApp();
  });

  it('POST /api/songs should create a song', () => {
    return request(app.getHttpServer())
      .post(`/${API_PREFIX}/songs`)
      .send({
        title: 'Test Song',
        artist: 'Test Artist',
        genre: 'Pop',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('title', 'Test Song');
        expect(res.body).toHaveProperty('artist', 'Test Artist');
        expect(res.body).toHaveProperty('genre', 'Pop');
        songId = res.body.id;
      });
  });

  it('GET /api/songs should return paginated songs', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/songs`)
      .query({ page: 1, limit: 10 })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
        expect(Array.isArray(res.body.data)).toBe(true);
      });
  });

  it('GET /api/songs/:id should return a song by id', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/songs/${songId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('id', songId);
        expect(res.body).toHaveProperty('title', 'Test Song');
      });
  });

  it('PUT /api/songs/:id should update a song', () => {
    return request(app.getHttpServer())
      .put(`/${API_PREFIX}/songs/${songId}`)
      .send({
        title: 'Updated Test Song',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('id', songId);
        expect(res.body).toHaveProperty('title', 'Updated Test Song');
      });
  });
});

