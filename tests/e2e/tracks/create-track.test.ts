import { TestingModule, Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { DataSource } from 'typeorm'

import { CreateTrackResponseDto } from '@/src/contexts/tracks/infrastructure/controllers/dtos/responses/create-track.response.dto'
import { CreateTrackRequestDto } from '@/src/contexts/tracks/infrastructure/controllers/dtos/requests/create-track.request.dto'
import { TracksRespositoryModule } from '@/src/contexts/tracks/infrastructure/repositories/tracks.module'
import { TracksController } from '@/src/contexts/tracks/infrastructure/controllers/tracks.controller'
import {
  TestTypeOrmConfigModule,
  testDto,
  mockDB,
} from '@/tests/utils/vitest-helpers'
import { TracksServiceModule } from '@/src/contexts/tracks/application/tracks.module'
import { APPLICATION_ERRORS } from '@/src/app/common/response-normalizer/errors'
import { generateValidatorError } from '@/tests/utils/helper-functions'
import { seedDb } from '@/tests/utils/seed'

describe('POST: Create Track', () => {
  let controller: TracksController
  let db: DataSource

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TracksServiceModule,
        TracksRespositoryModule,
        TypeOrmModule,
        ConfigModule.forRoot({ isGlobal: true, cache: true }),
      ],
      providers: [TracksController],
    })
      .overrideModule(TypeOrmModule)
      .useModule(TestTypeOrmConfigModule)
      .compile()

    controller = moduleFixture.get<TracksController>(TracksController)
  })

  beforeAll(async () => {
    db = await mockDB()
    await seedDb(db)
  })

  it('should create track without notes and return it', async () => {
    const result = await controller.createTrackWithLicense({
      rightsHolder: 'Sony',
      startTime: '00:00:00',
      endTime: '00:01:00',
      songId: 2,
      sceneId: 2,
    })
    expect(result).toBeDefined()

    expect(testDto(CreateTrackResponseDto, result)).toEqual({
      createdAt: expect.any(Date),
      endTime: '00:01:00',
      id: 3,
      license: {
        id: 3,
        notes: null,
        rightsHolder: 'Sony',
        status: 'pending',
      },
      sceneId: 2,
      songId: 2,
      startTime: '00:00:00',
    })
  })

  it('should create track with notes and return it', async () => {
    const result = await controller.createTrackWithLicense({
      rightsHolder: 'Sony',
      startTime: '00:00:00',
      endTime: '00:01:00',
      songId: 2,
      sceneId: 2,
      notes: 'CEO wants it now!',
    })
    expect(result).toBeDefined()

    expect(testDto(CreateTrackResponseDto, result)).toEqual({
      createdAt: expect.any(Date),
      endTime: '00:01:00',
      id: 4,
      license: {
        id: 4,
        notes: 'CEO wants it now!',
        rightsHolder: 'Sony',
        status: 'pending',
      },
      sceneId: 2,
      songId: 2,
      startTime: '00:00:00',
    })
  })

  it('should return wrong format error', async () => {
    const result = controller.createTrackWithLicense({
      rightsHolder: 'Sony',
      startTime: '00:01',
      endTime: '00:12',
      songId: 2,
      sceneId: 2,
      notes: 'CEO wants it now!',
    })
    await expect(result).rejects.toMatchObject(
      APPLICATION_ERRORS.TRACKS.WRONG_TIME_FORMAT,
    )
  })

  it('should return wrong time format error when passed something that is not a timestamp', async () => {
    const result = controller.createTrackWithLicense({
      rightsHolder: 'Sony',
      startTime: 'pepe',
      endTime: 'pepon',
      songId: 2,
      sceneId: 2,
      notes: 'CEO wants it now!',
    })
    await expect(result).rejects.toMatchObject(
      APPLICATION_ERRORS.TRACKS.WRONG_TIME_FORMAT,
    )
  })

  it('should return error when we pass a non valid interval (endtime smaller than starttime)', async () => {
    const result = controller.createTrackWithLicense({
      rightsHolder: 'Sony',
      startTime: '00:01:00',
      endTime: '00:00:30',
      songId: 2,
      sceneId: 2,
      notes: 'CEO wants it now!',
    })
    await expect(result).rejects.toMatchObject(
      APPLICATION_ERRORS.TRACKS.INVALID_TRACK_TIMES,
    )
  })

  it('should return error when we pass a interval longer than the song', async () => {
    const result = controller.createTrackWithLicense({
      rightsHolder: 'Sony',
      startTime: '00:00:00',
      endTime: '00:15:30',
      songId: 2,
      sceneId: 2,
      notes: 'CEO wants it now!',
    })
    await expect(result).rejects.toMatchObject(
      APPLICATION_ERRORS.TRACKS.TRACK_EXCEEDS_SONG_DURATION,
    )
  })

  it('should return error when we pass a non existing song', async () => {
    const result = controller.createTrackWithLicense({
      rightsHolder: 'Sony',
      startTime: '00:00:00',
      endTime: '00:15:30',
      songId: 25,
      sceneId: 2,
      notes: 'CEO wants it now!',
    })
    await expect(result).rejects.toMatchObject(
      APPLICATION_ERRORS.SONGS.NOT_FOUND_ERROR,
    )
  })

  it('should return error when we pass a non existing scene', async () => {
    const result = controller.createTrackWithLicense({
      rightsHolder: 'Sony',
      startTime: '00:00:00',
      endTime: '00:15:30',
      songId: 2,
      sceneId: 25,
      notes: 'CEO wants it now!',
    })
    await expect(result).rejects.toMatchObject(
      APPLICATION_ERRORS.SCENES.NOT_FOUND_ERROR,
    )
  })

  it('should reject invalid body', async () => {
    const result = generateValidatorError(CreateTrackRequestDto, {})
    expect(result).toEqual({
      validationErrors: [
        {
          sceneId: {
            isInt: 'sceneId must be an integer number',
            isNotEmpty: 'sceneId should not be empty',
            isPositive: 'sceneId must be a positive number',
          },
        },
        {
          songId: {
            isInt: 'songId must be an integer number',
            isNotEmpty: 'songId should not be empty',
            isPositive: 'songId must be a positive number',
          },
        },
        {
          startTime: {
            isNotEmpty: 'startTime should not be empty',
          },
        },
        {
          endTime: {
            isNotEmpty: 'endTime should not be empty',
          },
        },
        {
          rightsHolder: {
            isNotEmpty: 'rightsHolder should not be empty',
          },
        },
      ],
      message: 'One or more fields were invalid',
      statusCode: 400,
    })
  })
})
