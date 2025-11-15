import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { envs } from '../config/envs';
import { IncomingMessage, Server, ServerResponse } from 'http';

type TrackResponse = {
  id: string;
  scene: { id: string };
  song: unknown;
  licensingStatus: string;
};

const isTrackResponseArray = (payload: unknown): payload is TrackResponse[] =>
  Array.isArray(payload) &&
  payload.every((item) => {
    if (typeof item !== 'object' || item === null) {
      return false;
    }
    const candidate = item as TrackResponse;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.licensingStatus !== 'string'
    ) {
      return false;
    }
    if (
      typeof candidate.scene !== 'object' ||
      candidate.scene === null ||
      typeof candidate.scene.id !== 'string'
    ) {
      return false;
    }
    return true;
  });

const isHttpServer = (
  server: unknown,
): server is Server<typeof IncomingMessage, typeof ServerResponse> =>
  server instanceof Server;

describe('Tracks integration (HTTP + DB real)', () => {
  let app: INestApplication;
  let httpServer: Server<typeof IncomingMessage, typeof ServerResponse>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(`api/${envs.apiVersion}`);
    await app.init();
    const rawServer: unknown = app.getHttpServer();
    if (!isHttpServer(rawServer)) {
      throw new Error('HTTP server not initialized correctly');
    }
    httpServer = rawServer;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should run seed and then return tracks for a seeded scene', async () => {
    await request(httpServer).get(`/api/${envs.apiVersion}/seed`).expect(200);

    const sceneId = 'cc8b7b6c-3c1a-4c39-b4ef-839b69c21eab';

    const res: Response = await request(httpServer)
      .get(`/api/${envs.apiVersion}/tracks/scenes/${sceneId}`)
      .expect(200);

    expect(isTrackResponseArray(res.body)).toBe(true);
    const tracks = res.body as TrackResponse[];
    expect(tracks.length).toBeGreaterThan(0);

    const track = tracks[0];
    expect(track).toHaveProperty('id');
    expect(track).toHaveProperty('scene');
    expect(track.scene.id).toBe(sceneId);
    expect(track).toHaveProperty('song');
    expect(track).toHaveProperty('licensingStatus');
  });
});
