import { ApiProperty } from '@nestjs/swagger'
import { Expose } from 'class-transformer'

export class CreateMovieResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the movie',
    example: 1,
  })
  @Expose()
  id: number

  @ApiProperty({ description: 'Name of the movie', example: 'Inception' })
  @Expose()
  name: string

  @ApiProperty({
    description: 'Date when the movie was created',
    example: '2025-09-25T14:30:00.000Z',
  })
  @Expose()
  createdAt: Date
}
