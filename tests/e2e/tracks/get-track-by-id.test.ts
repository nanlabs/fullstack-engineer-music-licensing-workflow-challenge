import { TestingModule, Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { DataSource } from 'typeorm'

import { GetTrackByIdResponseDto } from '@/src/contexts/tracks/infrastructure/controllers/dtos/responses/get-track-license-history.response.dto'
import { GetTrackByIdRequestDto } from '@/src/contexts/tracks/infrastructure/controllers/dtos/requests/get-license-status-request.dto'
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

describe('GET: Get Track by ID', () => {
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

  it('should return track by ID', async () => {
    const result = await controller.getTrackLicenseStatusHistory({ id: 1 })
    expect(result).toBeDefined()

    expect(testDto(GetTrackByIdResponseDto, result)).toEqual({
      createdAt: expect.any(Date),
      endTime: '00:01:30',
      id: 1,
      license: {
        id: 1,
        licenseHistory: [
          {
            createdAt: expect.any(Date),
            id: 1,
            newStatus: 'negotiating',
            oldStatus: 'pending',
          },
          {
            createdAt: expect.any(Date),
            id: 2,
            newStatus: 'approved',
            oldStatus: 'negotiating',
          },
        ],
        notes: 'Soundtrack license for cinematic release',
        rightsHolder: 'Warner Bros',
        status: 'approved',
      },
      sceneId: 1,
      songId: 1,
      startTime: '00:00:15',
    })
  })

  it('should return not found error', async () => {
    const result = controller.getTrackLicenseStatusHistory({ id: 192 })
    await expect(result).rejects.toMatchObject(
      APPLICATION_ERRORS.TRACKS.NOT_FOUND_ERROR,
    )
  })

  it('should reject invalid params', async () => {
    const result = generateValidatorError(GetTrackByIdRequestDto, {})
    expect(result).toEqual({
      validationErrors: [
        {
          id: {
            isInt: 'id must be an integer number',
            isNotEmpty: 'id should not be empty',
            isPositive: 'id must be a positive number',
          },
        },
      ],
      message: 'One or more fields were invalid',
      statusCode: 400,
    })
  })
})
