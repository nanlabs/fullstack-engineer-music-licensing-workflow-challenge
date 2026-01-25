import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
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
  @ValidateIf((o) => o.updatedBy !== undefined)
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  updatedBy?: string;
}
