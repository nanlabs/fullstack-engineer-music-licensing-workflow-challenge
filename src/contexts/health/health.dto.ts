import { ApiProperty } from '@nestjs/swagger'
import { Expose } from 'class-transformer'

export class HealthCheckResponseDto {
  @ApiProperty({ example: 'ok' })
  @Expose()
  status: string

  @ApiProperty({ example: 91.849_277_717 })
  @Expose()
  uptime: number
}
