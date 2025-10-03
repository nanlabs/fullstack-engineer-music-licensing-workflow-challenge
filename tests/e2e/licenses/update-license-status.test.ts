import { TestingModule, Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { DataSource } from 'typeorm'

import { UpdateLicenseStatusParamsDto } from '@/src/contexts/licenses/infrastructure/controllers/dtos/requests/update-license-params.requests.dto'
import { UpdateLicenseStatusRequestDto } from '@/src/contexts/licenses/infrastructure/controllers/dtos/requests/update-license-status.dto'
import { UpdateLicenseByIdResponseDto } from '@/src/contexts/licenses/infrastructure/controllers/dtos/responses/update-license.dto'
import { LicensesRespositoryModule } from '@/src/contexts/licenses/infrastructure/repositories/licenses.module'
import {
  generateTransitionErrorMessage,
  generateValidatorError,
} from '@/tests/utils/helper-functions'
import { LicensesController } from '@/src/contexts/licenses/infrastructure/controllers/licenses.controller'
import {
  TestTypeOrmConfigModule,
  testDto,
  mockDB,
} from '@/tests/utils/vitest-helpers'
import { LicenseHistory } from '@/src/contexts/license-history/domain/license-history.entity'
import { LicensesServiceModule } from '@/src/contexts/licenses/application/licenses.module'
import { APPLICATION_ERRORS } from '@/src/app/common/response-normalizer/errors'
import { Licenses } from '@/src/contexts/licenses/domain/licenses.entity'
import { LicenseStatus } from '@/src/app/database/types'
import { seedDb } from '@/tests/utils/seed'

describe('PATCH: License status', () => {
  let controller: LicensesController
  let db: DataSource

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        LicensesServiceModule,
        LicensesRespositoryModule,
        TypeOrmModule,
        ConfigModule.forRoot({ isGlobal: true, cache: true }),
      ],
      providers: [LicensesController],
    })
      .overrideModule(TypeOrmModule)
      .useModule(TestTypeOrmConfigModule)
      .compile()

    controller = moduleFixture.get<LicensesController>(LicensesController)
  })

  beforeAll(async () => {
    db = await mockDB()
    await seedDb(db)
  })

  test.each([
    {
      nextStatus: LicenseStatus.EXPIRED,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.PENDING,
        to: LicenseStatus.EXPIRED,
      }),
    },
    {
      nextStatus: LicenseStatus.PENDING,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.PENDING,
        to: LicenseStatus.PENDING,
      }),
    },
    {
      nextStatus: LicenseStatus.APPROVED,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.PENDING,
        to: LicenseStatus.APPROVED,
      }),
    },
  ])(
    'should reject invalid transition',
    async ({ nextStatus, expectedMessage }) => {
      const id = 2
      const result = controller.updateLicense({ id }, { status: nextStatus })
      await expect(result).rejects.toMatchObject({
        ...APPLICATION_ERRORS.LICENSES.INVALID_TRANSITION,
        message: expectedMessage,
      })
    },
  )

  it('should return updated license', async () => {
    const id = 2

    const licenseBefore = await db
      .getRepository(Licenses)
      .findOneOrFail({ where: { id } })
    const result = await controller.updateLicense(
      { id },
      { status: LicenseStatus.NEGOCIATING },
    )
    expect(result).toBeDefined()

    const licenseAfter = await db
      .getRepository(Licenses)
      .findOneOrFail({ where: { id } })

    expect(testDto(UpdateLicenseByIdResponseDto, result)).toEqual({
      createdAt: expect.any(Date),
      id: 2,
      notes: 'Expired distribution license',
      rightsHolder: 'Village Roadshow',
      status: 'negotiating',
      track: {
        endTime: '00:03:00',
        id: 2,
        scene: {
          id: 2,
          name: 'Lobby Scene',
        },
        song: {
          artistName: 'Rob Dougan',
          duration: '00:07:11',
          id: 2,
          name: 'Clubbed to Death',
        },
        startTime: '00:01:10',
      },
      updatedAt: expect.any(Date),
    })

    expect(licenseBefore.status).not.toEqual(licenseAfter.status)
    expect(licenseBefore.updatedAt).not.toEqual(licenseAfter.updatedAt)
    const licenseHistory = await db
      .getRepository(LicenseHistory)
      .findOneOrFail({ where: { licenseId: id } })
    expect(licenseHistory).toEqual({
      id: 3,
      licenseId: id,
      oldStatus: licenseBefore.status,
      newStatus: licenseAfter.status,
      createdAt: licenseAfter.updatedAt,
      license: undefined,
    })
  })

  test.each([
    {
      nextStatus: LicenseStatus.EXPIRED,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.NEGOCIATING,
        to: LicenseStatus.EXPIRED,
      }),
    },
    {
      nextStatus: LicenseStatus.PENDING,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.NEGOCIATING,
        to: LicenseStatus.PENDING,
      }),
    },
    {
      nextStatus: LicenseStatus.NEGOCIATING,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.NEGOCIATING,
        to: LicenseStatus.NEGOCIATING,
      }),
    },
  ])(
    'should reject invalid transition',
    async ({ nextStatus, expectedMessage }) => {
      const id = 2
      const result = controller.updateLicense({ id }, { status: nextStatus })
      await expect(result).rejects.toMatchObject({
        ...APPLICATION_ERRORS.LICENSES.INVALID_TRANSITION,
        message: expectedMessage,
      })
    },
  )

  it('should return updated license when going from negotiating to rejected', async () => {
    const id = 2

    const licenseBefore = await db
      .getRepository(Licenses)
      .findOneOrFail({ where: { id } })
    const result = await controller.updateLicense(
      { id },
      { status: LicenseStatus.REJECTED },
    )
    expect(result).toBeDefined()

    const licenseAfter = await db
      .getRepository(Licenses)
      .findOneOrFail({ where: { id } })

    expect(testDto(UpdateLicenseByIdResponseDto, result)).toEqual({
      createdAt: expect.any(Date),
      id: 2,
      notes: 'Expired distribution license',
      rightsHolder: 'Village Roadshow',
      status: LicenseStatus.REJECTED,
      track: {
        endTime: '00:03:00',
        id: 2,
        scene: {
          id: 2,
          name: 'Lobby Scene',
        },
        song: {
          artistName: 'Rob Dougan',
          duration: '00:07:11',
          id: 2,
          name: 'Clubbed to Death',
        },
        startTime: '00:01:10',
      },
      updatedAt: expect.any(Date),
    })

    expect(licenseBefore.status).not.toEqual(licenseAfter.status)
    expect(licenseBefore.updatedAt).not.toEqual(licenseAfter.updatedAt)
    const licenseHistory = await db
      .getRepository(LicenseHistory)
      .findOneOrFail({
        where: { licenseId: id },
        order: {
          createdAt: 'DESC',
        },
      })
    expect(licenseHistory).toEqual({
      id: 4,
      licenseId: id,
      oldStatus: licenseBefore.status,
      newStatus: licenseAfter.status,
      createdAt: licenseAfter.updatedAt,
      license: undefined,
    })
  })

  test.each([
    {
      nextStatus: LicenseStatus.APPROVED,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.REJECTED,
        to: LicenseStatus.APPROVED,
      }),
    },
    {
      nextStatus: LicenseStatus.PENDING,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.REJECTED,
        to: LicenseStatus.PENDING,
      }),
    },
    {
      nextStatus: LicenseStatus.NEGOCIATING,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.REJECTED,
        to: LicenseStatus.NEGOCIATING,
      }),
    },
    {
      nextStatus: LicenseStatus.REJECTED,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.REJECTED,
        to: LicenseStatus.REJECTED,
      }),
    },
  ])(
    'should reject invalid transition',
    async ({ nextStatus, expectedMessage }) => {
      const id = 2
      const result = controller.updateLicense({ id }, { status: nextStatus })
      await expect(result).rejects.toMatchObject({
        ...APPLICATION_ERRORS.LICENSES.INVALID_TRANSITION,
        message: expectedMessage,
      })
    },
  )

  test.each([
    {
      nextStatus: LicenseStatus.APPROVED,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.APPROVED,
        to: LicenseStatus.APPROVED,
      }),
    },
    {
      nextStatus: LicenseStatus.NEGOCIATING,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.APPROVED,
        to: LicenseStatus.NEGOCIATING,
      }),
    },
    {
      nextStatus: LicenseStatus.PENDING,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.APPROVED,
        to: LicenseStatus.PENDING,
      }),
    },
    {
      nextStatus: LicenseStatus.REJECTED,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.APPROVED,
        to: LicenseStatus.REJECTED,
      }),
    },
  ])(
    'should reject invalid transition',
    async ({ nextStatus, expectedMessage }) => {
      const id = 1
      const result = controller.updateLicense({ id }, { status: nextStatus })
      await expect(result).rejects.toMatchObject({
        ...APPLICATION_ERRORS.LICENSES.INVALID_TRANSITION,
        message: expectedMessage,
      })
    },
  )

  it('should return updated license when going from approved to expired', async () => {
    const id = 1

    const licenseBefore = await db
      .getRepository(Licenses)
      .findOneOrFail({ where: { id } })
    const result = await controller.updateLicense(
      { id },
      { status: LicenseStatus.EXPIRED },
    )
    expect(result).toBeDefined()

    const licenseAfter = await db
      .getRepository(Licenses)
      .findOneOrFail({ where: { id } })

    expect(testDto(UpdateLicenseByIdResponseDto, result)).toEqual({
      createdAt: expect.any(Date),
      id: 1,
      notes: 'Soundtrack license for cinematic release',
      rightsHolder: 'Warner Bros',
      status: 'expired',
      track: {
        endTime: '00:01:30',
        id: 1,
        scene: {
          id: 1,
          name: 'Opening Scene',
        },
        song: {
          artistName: 'Hans Zimmer',
          duration: '00:04:36',
          id: 1,
          name: 'Time',
        },
        startTime: '00:00:15',
      },
      updatedAt: expect.any(Date),
    })

    expect(licenseBefore.status).not.toEqual(licenseAfter.status)
    expect(licenseBefore.updatedAt).not.toEqual(licenseAfter.updatedAt)
    const licenseHistory = await db
      .getRepository(LicenseHistory)
      .findOneOrFail({
        where: { licenseId: id },
        order: {
          createdAt: 'DESC',
        },
      })
    expect(licenseHistory).toEqual({
      id: 5,
      licenseId: id,
      oldStatus: licenseBefore.status,
      newStatus: licenseAfter.status,
      createdAt: licenseAfter.updatedAt,
      license: undefined,
    })
  })

  test.each([
    {
      nextStatus: LicenseStatus.EXPIRED,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.EXPIRED,
        to: LicenseStatus.EXPIRED,
      }),
    },
    {
      nextStatus: LicenseStatus.APPROVED,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.EXPIRED,
        to: LicenseStatus.APPROVED,
      }),
    },
    {
      nextStatus: LicenseStatus.REJECTED,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.EXPIRED,
        to: LicenseStatus.REJECTED,
      }),
    },
    {
      nextStatus: LicenseStatus.PENDING,
      expectedMessage: generateTransitionErrorMessage({
        from: LicenseStatus.EXPIRED,
        to: LicenseStatus.PENDING,
      }),
    },
  ])(
    'should reject invalid transition',
    async ({ nextStatus, expectedMessage }) => {
      const id = 1
      const result = controller.updateLicense({ id }, { status: nextStatus })
      await expect(result).rejects.toMatchObject({
        ...APPLICATION_ERRORS.LICENSES.INVALID_TRANSITION,
        message: expectedMessage,
      })
    },
  )

  it('should reject invalid status', async () => {
    const result = generateValidatorError(UpdateLicenseStatusRequestDto, {
      status: 'pepe' as LicenseStatus,
    })
    expect(result).toEqual({
      validationErrors: [
        {
          status: {
            isEnum:
              'status must be a valid enum value: pending, negotiating, approved, rejected, expired',
          },
        },
      ],
      message: 'One or more fields were invalid',
      statusCode: 400,
    })
  })

  it('should reject invalid id', async () => {
    const result = generateValidatorError(UpdateLicenseStatusParamsDto, {
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
