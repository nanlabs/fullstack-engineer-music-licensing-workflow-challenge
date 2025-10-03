import { Transform, Expose, Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

import { secondsToHHMMSS } from '@/src/shared/utils/time-transforms'
import { Tracks } from '@/src/contexts/tracks/domain/tracks.entity'
import { LicenseStatus } from '@/src/app/database/types'

class LicenseDto {
  @Expose()
  @ApiProperty({ description: 'License ID', example: 1 })
  id: number

  @Expose()
  @ApiProperty({
    description: 'License status',
    example: LicenseStatus.PENDING,
  })
  status: LicenseStatus

  @Expose()
  @ApiProperty({ description: 'Rights holder', example: 'Warner Bros' })
  rightsHolder: string

  @Expose()
  @ApiProperty({
    description: 'Notes regarding the license.',
    example: 'The CEO wants this ASAP.',
    required: false,
  })
  notes?: string
}

export class CreateTrackResponseDto {
  @Expose()
  @ApiProperty({ description: 'Track ID', example: 1 })
  id: number

  @Expose()
  @ApiProperty({ description: 'Scene ID', example: 1 })
  sceneId: number

  @Expose()
  @ApiProperty({ description: 'Song ID', example: 2 })
  songId: number

  @Expose()
  @ApiProperty({
    description: 'Start time of the track (HH:MM:SS)',
    example: '00:00:15',
  })
  @Transform(({ obj }: { obj: Tracks }) => secondsToHHMMSS(obj.startTime))
  startTime: string

  @Expose()
  @ApiProperty({
    description: 'End time of the track (HH:MM:SS)',
    example: '00:01:30',
  })
  @Transform(({ obj }: { obj: Tracks }) => secondsToHHMMSS(obj.endTime))
  endTime: string

  @Expose()
  @ApiProperty({
    description: 'Created at timestamp',
    example: '2025-09-22T10:15:30.000Z',
  })
  createdAt: Date

  @Expose()
  @Type(() => LicenseDto)
  @ApiProperty({ type: LicenseDto })
  license: LicenseDto
}
