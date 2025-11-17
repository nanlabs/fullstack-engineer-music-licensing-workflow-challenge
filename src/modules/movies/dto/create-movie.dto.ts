import { IsNotEmpty, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMovieDto {
  @ApiProperty({
    description: 'Title of the movie',
    example: 'The Matrix',
    type: String,
  })
  @IsString({ message: i18nValidationMessage('validation.isString.title') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.isNotEmpty.title') })
  title: string;

  @ApiProperty({
    description: 'Description of the movie',
    example: 'A computer hacker learns about the true nature of reality',
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
