import { Transform, Expose } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

import { secondsToHHMMSS } from '@/src/shared/utils/time-transforms'

import { Songs } from '../../../domain/songs.entity'

export class CreateSongResponseDto {
  @ApiProperty({ description: 'Unique identifier for the song' })
  @Expose()
  id: string

  @ApiProperty({ description: 'Name of the song' })
  @Expose()
  name: string

  @ApiProperty({ description: 'Artist of the song' })
  @Expose()
  artistName: string

  @ApiProperty({ description: 'Artist of the song' })
  @Expose()
  @Transform(({ obj }: { obj: Songs }) => secondsToHHMMSS(obj.duration))
  duration: string

  @ApiProperty({ description: 'Date when the song was created' })
  @Expose()
  createdAt: Date
}
