import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTrackDto {
  @ApiPropertyOptional({
    description: 'Start time of the track in seconds',
    example: 0,
    type: Number,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.isInt.start_time_seconds'),
  })
  @IsPositive({
    message: i18nValidationMessage('validation.isPositive.start_time_seconds'),
  })
  @Transform(({ value }) => parseInt(value))
  start_time_seconds?: number;

  @ApiPropertyOptional({
    description: 'End time of the track in seconds',
    example: 120,
    type: Number,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.isInt.end_time_seconds'),
  })
  @IsPositive({
    message: i18nValidationMessage('validation.isPositive.end_time_seconds'),
  })
  @Transform(({ value }) => parseInt(value))
  end_time_seconds?: number;
}
