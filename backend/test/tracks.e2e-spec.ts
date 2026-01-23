import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('Tracks Licensing System', () => {
  let app: INestApplication;
  let movieId: string;
  let sceneId: string;
  let songId: string;
  let trackId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('Should create a movie', async () => {
    const response = await request(app.getHttpServer())
      .post('/movies')
      .send({title: 'Test Movie', releaseDate: new Date().toISOString()})
      .expect(201)

    movieId = response.body.id
    expect(response.body).toHaveProperty('id')
  })

  it('Should create a scene', async () => {
    const response = await request(app.getHttpServer())
      .post('/scenes')
      .send({ description: 'Test Scene', movieId: movieId, startTime: 0 })
      .expect(201)

    sceneId = response.body.id
    expect(response.body).toHaveProperty('id')
  })

  it('Should create a song', async () => {
    const response = await request(app.getHttpServer())
      .post('/songs')
      .send({ title: 'Test Song', artist: 'Test Artist', label: 'Test Label' })
      .expect(201)

    songId = response.body.id
    expect(response.body).toHaveProperty('id')
  })

  it('Should create a track', async () => {
    const response = await request(app.getHttpServer())
      .post('/tracks')
      .send({
            sceneId,
            songId,
            startInScene: 0,
            endInScene: 10
        })
      .expect(201)

    expect(response.body).toHaveProperty('id')
  })

  it('Should get tracks for a scene', async () => {
    const response = await request(app.getHttpServer())
      .get(`/scenes/${sceneId}/tracks`)
      .expect(200)

    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body.length).toBeGreaterThan(0)
    trackId = response.body[0].id
  })

  it('Should get tracks for a movie', async () => {
    const response = await request(app.getHttpServer())
      .get(`/movies/${movieId}/tracks`)
      .expect(200)

    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body.length).toBeGreaterThan(0)
  })

  it('Should update track licensing status', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/tracks/${trackId}/status`)
      .send({ status: 'NEGOTIATING' })
      .expect(200)

    expect(response.body.status).toBe('NEGOTIATING')
  })

  it('Should fail to update track with incorrect status', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/tracks/${trackId}/status`)
      .send({ status: 'PENDING' })
      .expect(400)

    expect(response.body.message).toContain('Invalid status transition')
  })
})