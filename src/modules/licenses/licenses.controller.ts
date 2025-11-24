import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Sse,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { LicensesService } from './licenses.service';
import { LicensesUpdatesGateway } from './licenses-updates.gateway';
import { CreateLicenseDto, UpdateLicenseStatusDto } from './dto';

@ApiTags('licenses')
@Controller('api/licenses')
export class LicensesController {
  constructor(
    private readonly licensesService: LicensesService,
    private readonly updatesGateway: LicensesUpdatesGateway,
  ) {}

  @ApiOperation({ summary: 'Create a new license' })
  @ApiResponse({ status: 201, description: 'License created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @Post()
  create(@Body() createLicenseDto: CreateLicenseDto) {
    return this.licensesService.create(createLicenseDto);
  }

  @ApiOperation({ summary: 'Get all licenses' })
  @ApiResponse({ status: 200, description: 'List of all licenses' })
  @Get()
  findAll() {
    return this.licensesService.findAll();
  }

  @ApiOperation({ summary: 'Get a license by ID' })
  @ApiResponse({ status: 200, description: 'License found' })
  @ApiResponse({ status: 404, description: 'License not found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.licensesService.findOne(id);
  }

  @ApiOperation({ summary: 'Get licenses by track ID' })
  @ApiResponse({ status: 200, description: 'List of licenses for the track' })
  @Get('track/:trackId')
  findByTrackId(@Param('trackId') trackId: string) {
    return this.licensesService.findByTrackId(trackId);
  }

  @ApiOperation({ summary: 'Update license status' })
  @ApiResponse({
    status: 200,
    description: 'License status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'License not found' })
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateLicenseStatusDto: UpdateLicenseStatusDto,
  ) {
    return this.licensesService.updateStatus(id, updateLicenseStatusDto);
  }

  @ApiOperation({ summary: 'Delete a license' })
  @ApiResponse({ status: 200, description: 'License deleted successfully' })
  @ApiResponse({ status: 404, description: 'License not found' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.licensesService.remove(id);
  }

  @ApiOperation({ summary: 'Stream license updates via Server-Sent Events' })
  @ApiResponse({ status: 200, description: 'License updates stream' })
  @Sse('updates/stream')
  updates(): Observable<MessageEvent> {
    return this.updatesGateway.getLicenseUpdates();
  }
}
