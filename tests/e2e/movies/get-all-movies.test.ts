import { TestingModule, Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { DataSource, In } from 'typeorm'

import { GetMoviesResponseDto } from '@/src/contexts/movies/infrastructure/controllers/dtos/responses/get-movies.response.dto'
import {
  TestTypeOrmConfigModule,
  testPaginatedDto,
  testDto,
  mockDB,
} from '@/tests/utils/vitest-helpers'
import { MoviesRespositoryModule } from '@/src/contexts/movies/infrastructure/repositories/movies.module'
import { MoviesController } from '@/src/contexts/movies/infrastructure/controllers/movies.controller'
import { MoviesServiceModule } from '@/src/contexts/movies/application/movies.module'
import { Movies } from '@/src/contexts/movies/domain/movies.entity'
import { Order } from '@/src/shared/pagination/page-options'
import { seedDb } from '@/tests/utils/seed'

describe('GET: Movies', () => {
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

  it('should return an array of movies', async () => {
    const result = await controller.getMovies({
      limit: 10,
      offset: 0,
      order: Order.ASC,
    })
    expect(result).toBeDefined()
    testPaginatedDto(GetMoviesResponseDto, result, {
      count: 2,
      currentPage: 1,
      pages: 1,
      items: [
        {
          createdAt: expect.any(Date),
          id: 1,
          name: 'Inception',
          updatedAt: expect.any(Date),
        },
        {
          createdAt: expect.any(Date),
          id: 2,
          name: 'The Matrix',
          updatedAt: expect.any(Date),
        },
      ],
    })
  })

  it('should return an empty array if we delete all the movies beforehand', async () => {
    await db.getRepository(Movies).softDelete({ id: In([1, 2]) })
    const result = await controller.getMovies({
      limit: 10,
      offset: 0,
      order: Order.ASC,
    })
    expect(result).toEqual({
      count: 0,
      currentPage: 1,
      items: [],
      pages: 1,
    })
    testDto(GetMoviesResponseDto, result)
  })
})
