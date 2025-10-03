import { ApiProperty } from '@nestjs/swagger'
import { Expose } from 'class-transformer'

export class GetMoviesResponseDto {
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
}
