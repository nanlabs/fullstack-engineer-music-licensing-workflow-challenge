import { IsEnum, IsNotEmpty } from 'class-validator';
import { LicenseStatusEnum } from '../entities/license.status.enum';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLicenseStatusDto {
  @ApiProperty({
    description: 'License status',
    enum: LicenseStatusEnum,
    example: LicenseStatusEnum.PENDING,
    enumName: 'LicenseStatusEnum',
  })
  @IsEnum(LicenseStatusEnum, {
    message: i18nValidationMessage('validation.isEnum.status'),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.isNotEmpty.status'),
  })
  status: LicenseStatusEnum;
}
