import { IsNotEmpty, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSongDto {
  @ApiProperty({
    description: 'Title of the song',
    example: 'Bohemian Rhapsody',
    type: String,
  })
  @IsNotEmpty({ message: i18nValidationMessage('validation.isNotEmpty.title') })
  @IsString({ message: i18nValidationMessage('validation.isString.title') })
  title: string;

  @ApiProperty({
    description: 'Artist name',
    example: 'Queen',
    type: String,
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.isNotEmpty.artist'),
  })
  @IsString({ message: i18nValidationMessage('validation.isString.artist') })
  artist: string;

  @ApiProperty({
    description: 'Genre of the song',
    example: 'Rock',
    type: String,
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.isNotEmpty.genre'),
  })
  @IsString({ message: i18nValidationMessage('validation.isString.genre') })
  genre: string;
}
