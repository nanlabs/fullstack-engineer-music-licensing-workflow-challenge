import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class FindAllTrackDto {
  @IsInt({ message: i18nValidationMessage('validation.isInt.page') })
  @IsOptional()
  @IsPositive({ message: i18nValidationMessage('validation.isPositive.page') })
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @IsInt({ message: i18nValidationMessage('validation.isInt.limit') })
  @IsOptional()
  @IsPositive({ message: i18nValidationMessage('validation.isPositive.limit') })
  @Transform(({ value }) => parseInt(value))
  limit?: number = 10;
}
