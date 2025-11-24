import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LicenseStatus } from '../../../entities';

export class CreateLicenseDto {
  @ApiProperty({
    description: 'The UUID of the track this license is for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  trackId: string;

  @ApiProperty({
    description: 'The status of the license',
    example: LicenseStatus.PENDING,
    enum: LicenseStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(LicenseStatus)
  status?: LicenseStatus;

  @ApiProperty({
    description: 'Optional notes about the license',
    example: 'Awaiting approval from copyright holder',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  notes?: string;
}

export class UpdateLicenseStatusDto {
  @ApiProperty({
    description: 'The new status of the license',
    example: LicenseStatus.APPROVED,
    enum: LicenseStatus,
  })
  @IsEnum(LicenseStatus)
  status: LicenseStatus;

  @ApiProperty({
    description: 'Optional notes about the license status update',
    example: 'Approved by copyright holder',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  notes?: string;
}
