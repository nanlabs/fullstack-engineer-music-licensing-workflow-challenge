import { IsString, IsOptional, IsEnum, IsUUID, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LicensingStatus } from '../../../entities/enums/licensing-status.enum';

export class CreateLicenseDto {
  @ApiProperty({ description: 'Track ID this license belongs to' })
  @IsUUID()
  trackId: string;

  @ApiProperty({ description: 'License status', enum: LicensingStatus })
  @IsEnum(LicensingStatus)
  status: LicensingStatus;

  @ApiProperty({ description: 'License fee', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  licenseFee?: number;

  @ApiProperty({ description: 'Currency', required: false, default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'License notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Contact person', required: false })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiProperty({ description: 'Contact email', required: false })
  @IsOptional()
  @IsString()
  contactEmail?: string;
}