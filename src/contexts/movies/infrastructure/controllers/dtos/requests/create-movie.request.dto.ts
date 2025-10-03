import { IsNotEmpty, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateMovieRequestDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Title of the movie',
    example: 'The Matrix',
  })
  name: string
}
