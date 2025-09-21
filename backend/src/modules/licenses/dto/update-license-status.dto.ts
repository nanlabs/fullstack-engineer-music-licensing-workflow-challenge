import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { LicenseStatusEnum } from '../../../common/enums/license-status.enum';

export class UpdateLicenseStatusDto {
  @ApiProperty({
    description: 'New license status',
    enum: LicenseStatusEnum,
  })
  @IsEnum(LicenseStatusEnum)
  status: LicenseStatusEnum;
}
