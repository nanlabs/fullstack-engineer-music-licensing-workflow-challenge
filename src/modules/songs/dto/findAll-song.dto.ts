import { Transform } from 'class-transformer';
import { IsOptional, IsInt, IsPositive, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindAllSongDto {
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
  page?: number;

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
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by song title',
    example: 'Bohemian',
    type: String,
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString.title') })
  title?: string;

  @ApiPropertyOptional({
    description: 'Filter by artist name',
    example: 'Queen',
    type: String,
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString.artist') })
  artist?: string;
}
