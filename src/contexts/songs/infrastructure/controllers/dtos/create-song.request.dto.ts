import { IsNotEmpty, IsString, Length } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateSongRequestDto {
  @ApiProperty({
    description: 'Title of the song',
    example: 'Bohemian Rhapsody',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string

  @ApiProperty({ description: 'Artist of the song', example: 'Queen' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  artistName: string

  @ApiProperty({
    description: 'Duration of the song in HH:MM:SS format',
    example: '00:03:45',
  })
  @IsString()
  @IsNotEmpty()
  duration: string
}
