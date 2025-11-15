import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { envs } from '../config/envs';

describe('Tracks integration (HTTP + DB real)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix(`api/${envs.apiVersion}`);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should run seed and then return tracks for a seeded scene', async () => {
    await request(app.getHttpServer())
      .get(`/api/${envs.apiVersion}/seed`)
      .expect(200);

    const sceneId = 'cc8b7b6c-3c1a-4c39-b4ef-839b69c21eab';

    const res = await request(app.getHttpServer())
      .get(`/api/${envs.apiVersion}/tracks/scenes/${sceneId}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const track = res.body[0];
    expect(track).toHaveProperty('id');
    expect(track).toHaveProperty('scene');
    expect(track.scene.id).toBe(sceneId);
    expect(track).toHaveProperty('song');
    expect(track).toHaveProperty('licensingStatus');
  });
});
