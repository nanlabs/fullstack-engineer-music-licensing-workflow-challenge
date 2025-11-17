import { Transform } from 'class-transformer';
import { IsOptional, IsInt, IsPositive } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindAllByMovieIdTrackDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    type: Number,
    minimum: 1,
    default: 1,
  })
  @IsInt({ message: i18nValidationMessage('validation.isInt.page') })
  @IsOptional()
  @IsPositive({ message: i18nValidationMessage('validation.isPositive.page') })
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    type: Number,
    minimum: 1,
    default: 10,
  })
  @IsInt({ message: i18nValidationMessage('validation.isInt.limit') })
  @IsOptional()
  @IsPositive({ message: i18nValidationMessage('validation.isPositive.limit') })
  @Transform(({ value }) => parseInt(value))
  limit?: number = 10;
}
