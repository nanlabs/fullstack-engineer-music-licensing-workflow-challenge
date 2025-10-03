import { TestingModule, Test } from '@nestjs/testing'

import { HealthController } from '@/src/contexts/health/health.controller'
import { HealthCheckResponseDto } from '@/src/contexts/health/health.dto'
import { HealthModule } from '@/src/contexts/health/health.module'

import { testDto } from '../utils/vitest-helpers'

describe('HealthController (unit)', () => {
  let controller: HealthController

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
      providers: [HealthController],
    }).compile()

    controller = moduleFixture.get<HealthController>(HealthController)
  })

  it('should return an object with status and uptime', () => {
    const result = controller.run()
    expect(testDto(HealthCheckResponseDto, result)).toEqual({
      status: 'ok',
      uptime: expect.any(Number) as number,
    })
  })
})
