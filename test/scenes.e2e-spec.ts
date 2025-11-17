import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '../src/common/constants/api.constants';
import { getApp, closeApp } from './setup.e2e';

describe('Scenes (e2e)', () => {
  let app: INestApplication;
  let movieId: number;
  let sceneId: number;

  beforeAll(async () => {
    app = await getApp();
    // Create a movie for scene tests
    const movieResponse = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/movies`)
      .send({
        title: 'Scene Test Movie',
        description: 'Movie for scene testing',
      });
    movieId = movieResponse.body.id;
  });

  afterAll(async () => {
    await closeApp();
  });

  it('POST /api/scenes should create a scene', () => {
    return request(app.getHttpServer())
      .post(`/${API_PREFIX}/scenes`)
      .send({
        movie_id: movieId,
        title: 'Test Scene',
        description: 'A test scene',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('title', 'Test Scene');
        expect(res.body).toHaveProperty('movie_id', movieId);
        sceneId = res.body.id;
      });
  });

  it('GET /api/scenes/movie/:movieId should return scenes for a movie', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/scenes/movie/${movieId}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('GET /api/scenes/:id should return a scene by id', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/scenes/${sceneId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('id', sceneId);
        expect(res.body).toHaveProperty('title', 'Test Scene');
      });
  });

  it('POST /api/scenes should return 404 for non-existent movie', () => {
    return request(app.getHttpServer())
      .post(`/${API_PREFIX}/scenes`)
      .send({
        movie_id: 99999,
        title: 'Test Scene',
        description: 'A test scene',
      })
      .expect(404);
  });
});

