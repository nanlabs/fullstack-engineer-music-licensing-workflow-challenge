import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { LicenseStatus } from '../../../entities';

export class CreateLicenseDto {
  @IsUUID()
  trackId: string;

  @IsOptional()
  @IsEnum(LicenseStatus)
  status?: LicenseStatus;

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  notes?: string;
}

export class UpdateLicenseStatusDto {
  @IsEnum(LicenseStatus)
  status: LicenseStatus;

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  notes?: string;
}
