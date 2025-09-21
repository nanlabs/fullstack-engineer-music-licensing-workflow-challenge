import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UpdateLicenseStatusDto } from '../dto/update-license-status.dto';
import { LicenseStatus } from '../entities/license-status.entity';
import { LicensesService } from '../services/licenses.service';

@ApiTags('licenses')
@Controller('licenses')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Post('songs/:songId/status')
  @ApiOperation({ summary: 'Update the licensing status of a song' })
  @ApiParam({ name: 'songId', description: 'Song ID' })
  @ApiResponse({
    status: 201,
    description: 'License status updated successfully',
    type: LicenseStatus,
  })
  @ApiResponse({ status: 400, description: 'Bad request or invalid status transition' })
  @ApiResponse({ status: 404, description: 'Song not found' })
  async updateSongLicenseStatus(
    @Param('songId', ParseIntPipe) songId: number,
    @Body() updateLicenseStatusDto: UpdateLicenseStatusDto,
  ): Promise<LicenseStatus> {
    return await this.licensesService.updateSongLicenseStatus(songId, updateLicenseStatusDto);
  }

  @Get('songs/:songId/history')
  @ApiOperation({ summary: 'Get license status history for a song' })
  @ApiParam({ name: 'songId', description: 'Song ID' })
  @ApiResponse({
    status: 200,
    description: 'License history retrieved successfully',
    type: [LicenseStatus],
  })
  @ApiResponse({ status: 404, description: 'Song not found' })
  async getLicenseHistory(@Param('songId', ParseIntPipe) songId: number): Promise<LicenseStatus[]> {
    return await this.licensesService.getLicenseHistory(songId);
  }

  @Get('songs/:songId/current')
  @ApiOperation({ summary: 'Get current license status for a song' })
  @ApiParam({ name: 'songId', description: 'Song ID' })
  @ApiResponse({
    status: 200,
    description: 'Current license status retrieved successfully',
    type: LicenseStatus,
  })
  @ApiResponse({ status: 404, description: 'Song not found' })
  async getCurrentLicenseStatus(
    @Param('songId', ParseIntPipe) songId: number,
  ): Promise<LicenseStatus | null> {
    return await this.licensesService.getCurrentLicenseStatus(songId);
  }

  @Post('tracks/:trackId/song/status')
  @ApiOperation({ summary: 'Update the licensing status of a song by track ID' })
  @ApiParam({ name: 'trackId', description: 'Track ID' })
  @ApiResponse({
    status: 201,
    description: 'Song license status updated successfully via track',
    type: LicenseStatus,
  })
  @ApiResponse({ status: 400, description: 'Bad request or invalid status transition' })
  @ApiResponse({ status: 404, description: 'Track not found or track has no associated song' })
  async updateSongLicenseStatusByTrack(
    @Param('trackId', ParseIntPipe) trackId: number,
    @Body() updateLicenseStatusDto: UpdateLicenseStatusDto,
  ): Promise<LicenseStatus> {
    return await this.licensesService.updateSongLicenseStatusByTrack(
      trackId,
      updateLicenseStatusDto,
    );
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get overall licensing statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStatistics(): Promise<any> {
    return await this.licensesService.getStatusStatistics();
  }
}
