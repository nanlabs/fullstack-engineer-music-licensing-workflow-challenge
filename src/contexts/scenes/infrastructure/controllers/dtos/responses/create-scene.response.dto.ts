import { ApiProperty } from '@nestjs/swagger'
import { Expose } from 'class-transformer'

export class CreateSceneResponseDto {
  @ApiProperty({ description: 'Unique identifier of the scene' })
  @Expose()
  id: number

  @ApiProperty({ description: 'Movie ID the scene belongs to' })
  @Expose()
  movieId: string

  @ApiProperty({ description: 'Name of the scene' })
  @Expose()
  name: string

  @ApiProperty({ description: 'Date when the scene was created' })
  @Expose()
  createdAt: Date
}
