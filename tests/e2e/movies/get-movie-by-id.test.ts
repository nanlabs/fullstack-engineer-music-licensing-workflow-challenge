import { TestingModule, Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { DataSource } from 'typeorm'

import { GetMovieByIdRequestDto } from '@/src/contexts/movies/infrastructure/controllers/dtos/requests/get-movie-by-id.dto'
import { GetMovieByIdResponseDto } from '@/src/contexts/movies/infrastructure/controllers/dtos/responses/movie-by-id.dto'
import { MoviesRespositoryModule } from '@/src/contexts/movies/infrastructure/repositories/movies.module'
import { MoviesController } from '@/src/contexts/movies/infrastructure/controllers/movies.controller'
import {
  TestTypeOrmConfigModule,
  testDto,
  mockDB,
} from '@/tests/utils/vitest-helpers'
import { MoviesServiceModule } from '@/src/contexts/movies/application/movies.module'
import { APPLICATION_ERRORS } from '@/src/app/common/response-normalizer/errors'
import { generateValidatorError } from '@/tests/utils/helper-functions'
import { seedDb } from '@/tests/utils/seed'

describe('GET/:id Movie', () => {
  let controller: MoviesController
  let db: DataSource

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MoviesServiceModule,
        MoviesRespositoryModule,
        TypeOrmModule,
        ConfigModule.forRoot({ isGlobal: true, cache: true }),
      ],
      providers: [MoviesController],
    })
      .overrideModule(TypeOrmModule)
      .useModule(TestTypeOrmConfigModule)
      .compile()

    controller = moduleFixture.get<MoviesController>(MoviesController)
  })

  beforeAll(async () => {
    db = await mockDB()
    await seedDb(db)
  })

  it('should return a movies with its details', async () => {
    const result = await controller.getMovieById({ id: 1 })
    expect(result).toBeDefined()
    testDto(GetMovieByIdResponseDto, result)
  })

  it('should return not found error if we pass a non existing id', async () => {
    const result = controller.getMovieById({ id: 356 })
    await expect(result).rejects.toMatchObject(
      APPLICATION_ERRORS.MOVIES.NOT_FOUND_ERROR,
    )
  })

  it('should reject invalid id', async () => {
    const result = generateValidatorError(GetMovieByIdRequestDto, {
      id: 'pepe',
    })
    expect(result).toEqual({
      validationErrors: [
        {
          id: {
            isInt: 'id must be an integer number',
            isPositive: 'id must be a positive number',
          },
        },
      ],
      message: 'One or more fields were invalid',
      statusCode: 400,
    })
  })
})
