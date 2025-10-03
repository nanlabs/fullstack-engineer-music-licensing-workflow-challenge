import { IsPositive, IsString, Length, IsInt } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateSceneRequestDto {
  @ApiProperty({ description: 'Movie ID the scene belongs to' })
  @IsInt()
  @IsPositive()
  movieId: number

  @ApiProperty({ description: 'Name of the scene' })
  @IsString()
  @Length(1, 255)
  name: string
}
