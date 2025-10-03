import { IsNotEmpty, IsPositive, IsOptional, IsInt } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'

export class CreateTrackRequestDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @ApiProperty({ description: 'ID of the scene', type: Number, example: 1 })
  sceneId: number

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @ApiProperty({ description: 'ID of the song', type: Number, example: 1 })
  songId: number

  @IsNotEmpty()
  @Type(() => String)
  @ApiProperty({
    description:
      'Start time of the track in the scene (PostgreSQL interval format)',
    example: '00:00:15',
  })
  startTime: string

  @IsNotEmpty()
  @Type(() => String)
  @ApiProperty({
    description:
      'End time of the track in the scene (PostgreSQL interval format)',
    example: '00:01:30',
  })
  endTime: string

  @IsNotEmpty()
  @Type(() => String)
  @ApiProperty({
    description: 'Rights holder of the license.',
    example: 'Warner Bros.',
  })
  rightsHolder: string

  @IsOptional()
  @Type(() => String)
  @ApiProperty({
    description: 'Notes regarding the license',
    example: 'The CEO wants this ASAP.',
    required: false,
  })
  notes?: string
}
