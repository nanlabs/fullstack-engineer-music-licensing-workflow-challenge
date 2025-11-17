import { IsInt, IsNotEmpty, IsPositive } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLicenseDto {
  @ApiProperty({
    description: 'ID of the track to create a license for',
    example: 1,
    type: Number,
    minimum: 1,
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.isNotEmpty.track_id'),
  })
  @IsInt({ message: i18nValidationMessage('validation.isInt.track_id') })
  @IsPositive({
    message: i18nValidationMessage('validation.isPositive.track_id'),
  })
  track_id: number;
}
