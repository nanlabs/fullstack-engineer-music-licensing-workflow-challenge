import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindAllMoviesDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    type: Number,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt.page') })
  @IsPositive({ message: i18nValidationMessage('validation.isPositive.page') })
  @Transform(({ value }) => parseInt(value))
  page: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    type: Number,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt.limit') })
  @IsPositive({ message: i18nValidationMessage('validation.isPositive.limit') })
  @Transform(({ value }) => parseInt(value))
  limit: number;

  @ApiPropertyOptional({
    description: 'Search term to filter movies by title or description',
    example: 'City',
    type: String,
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString.search') })
  search?: string;
}
