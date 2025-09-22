import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber } from 'class-validator';
import { LicenseStatusEnum } from '../../../common/enums/license-status.enum';

export class CreateLicenseStatusDto {
  @ApiProperty({
    description: 'Song ID for this license status',
  })
  @IsNumber()
  songId: number;

  @ApiProperty({
    description: 'License status',
    enum: LicenseStatusEnum,
  })
  @IsEnum(LicenseStatusEnum)
  status: LicenseStatusEnum;
}
