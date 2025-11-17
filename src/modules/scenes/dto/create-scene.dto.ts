import { IsNotEmpty, IsString, IsInt } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSceneDto {
  @ApiProperty({
    description: 'ID of the movie this scene belongs to',
    example: 1,
    type: Number,
  })
  @IsInt({ message: i18nValidationMessage('validation.isNumber.movie_id') })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.isNotEmpty.movie_id'),
  })
  movie_id: number;

  @ApiProperty({
    description: 'Title of the scene',
    example: 'Opening Scene',
    type: String,
  })
  @IsString({ message: i18nValidationMessage('validation.isString.title') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.isNotEmpty.title') })
  title: string;

  @ApiProperty({
    description: 'Description of the scene',
    example: 'The opening scene of the movie',
    type: String,
  })
  @IsString({
    message: i18nValidationMessage('validation.isString.description'),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.isNotEmpty.description'),
  })
  description: string;
}
