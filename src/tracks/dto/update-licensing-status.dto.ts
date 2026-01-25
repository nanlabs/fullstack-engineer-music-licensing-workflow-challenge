import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LicensingState } from '../../entities/track.entity';

export class UpdateLicensingStatusDto {
  @ApiProperty({ enum: LicensingState, example: LicensingState.NEGOTIATING })
  @IsEnum(LicensingState)
  status!: LicensingState;

  @ApiPropertyOptional({ example: 'Negotiating terms with rights holder' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  updatedBy?: string;
}
