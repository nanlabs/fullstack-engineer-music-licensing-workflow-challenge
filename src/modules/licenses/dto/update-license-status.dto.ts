import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LicensingStatus } from '../../../entities/enums/licensing-status.enum';

export class UpdateLicenseStatusDto {
  @ApiProperty({ description: 'New license status', enum: LicensingStatus })
  @IsEnum(LicensingStatus)
  status: LicensingStatus;

  @ApiProperty({ description: 'Status change notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}