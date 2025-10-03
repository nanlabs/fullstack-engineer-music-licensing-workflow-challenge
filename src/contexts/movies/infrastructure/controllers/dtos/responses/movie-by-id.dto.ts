import { Transform, Expose, Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

import { secondsToHHMMSS } from '@/src/shared/utils/time-transforms'
import { Tracks } from '@/src/contexts/tracks/domain/tracks.entity'
import { Songs } from '@/src/contexts/songs/domain/songs.entity'
import { LicenseStatus } from '@/src/app/database/types'

class SongDto {
  @Expose()
  @ApiProperty({ description: 'Song ID', example: 1 })
  id: number

  @Expose()
  @ApiProperty({ description: 'Song name', example: 'Time' })
  name: string

  @Expose()
  @ApiProperty({ description: 'Artist name', example: 'Hans Zimmer' })
  artistName: string

  @Expose()
  @ApiProperty({
    description: 'Song duration',
    example: '00:04:36',
    required: false,
  })
  @Transform(({ obj }: { obj: Songs }) => {
    return secondsToHHMMSS(obj.duration)
  })
  duration: string
}

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
}

class TrackDto {
  @Expose()
  @ApiProperty({ description: 'Track ID', example: 1 })
  id: number

  @Expose()
  @ApiProperty({ description: 'Track start time', example: '00:00:15' })
  @Transform(({ obj }: { obj: Tracks }) => {
    return secondsToHHMMSS(obj.startTime)
  })
  startTime: string

  @Expose()
  @ApiProperty({ description: 'Track end time', example: '00:01:30' })
  @Transform(({ obj }: { obj: Tracks }) => {
    return secondsToHHMMSS(obj.endTime)
  })
  endTime: string

  @Expose()
  @Type(() => SongDto)
  song: SongDto

  @Expose()
  @Type(() => LicenseDto)
  @ApiProperty({ type: LicenseDto })
  license: LicenseDto
}

class SceneDto {
  @Expose()
  @ApiProperty({ description: 'Scene ID', example: 1 })
  id: number

  @Expose()
  @ApiProperty({ description: 'Scene name', example: 'Lobby Scene' })
  name: number

  @Expose()
  @Type(() => TrackDto)
  @ApiProperty({ type: [TrackDto] })
  tracks: TrackDto[]
}

export class GetMovieByIdResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Movie ID',
    example: 1,
  })
  id: number

  @Expose()
  @ApiProperty({
    description: 'Movie name',
    example: 'The Matrix',
  })
  name: string

  @Expose()
  @ApiProperty({
    description: 'Movie creation date',
    example: new Date().toISOString(),
  })
  createdAt: Date

  @Expose()
  @ApiProperty({
    description: 'Movie update date',
    example: new Date().toISOString(),
  })
  updatedAt: Date

  @Expose()
  @Type(() => SceneDto)
  @ApiProperty({ type: [SceneDto] })
  scenes: SceneDto[]
}
