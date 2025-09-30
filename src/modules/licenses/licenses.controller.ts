import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { LicensesService } from './licenses.service';
import { CreateLicenseDto } from './dto/create-license.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';
import { UpdateLicenseStatusDto } from './dto/update-license-status.dto';
import { License } from '../../entities/license.entity';
import { LicensingStatus } from '../../entities/enums/licensing-status.enum';

@ApiTags('licensing')
@Controller('licenses')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new license' })
  @ApiResponse({
    status: 201,
    description: 'License created successfully',
    type: License,
  })
  async create(@Body() createLicenseDto: CreateLicenseDto): Promise<License> {
    return await this.licensesService.create(createLicenseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all licenses or filter by status' })
  @ApiQuery({ name: 'status', required: false, enum: LicensingStatus, description: 'Filter by license status' })
  @ApiResponse({
    status: 200,
    description: 'List of licenses',
    type: [License],
  })
  async findAll(@Query('status') status?: LicensingStatus): Promise<License[]> {
    if (status) {
      return await this.licensesService.findByStatus(status);
    }
    return await this.licensesService.findAll();
  }

  @Get('workflow-summary')
  @ApiOperation({ summary: 'Get workflow summary with counts by status' })
  @ApiResponse({
    status: 200,
    description: 'Workflow summary',
  })
  async getWorkflowSummary(): Promise<Record<LicensingStatus, number>> {
    return await this.licensesService.getWorkflowSummary();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a license by ID' })
  @ApiResponse({
    status: 200,
    description: 'License found',
    type: License,
  })
  @ApiResponse({
    status: 404,
    description: 'License not found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<License> {
    return await this.licensesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a license' })
  @ApiResponse({
    status: 200,
    description: 'License updated successfully',
    type: License,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLicenseDto: UpdateLicenseDto,
  ): Promise<License> {
    return await this.licensesService.update(id, updateLicenseDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update license status (workflow transition)' })
  @ApiResponse({
    status: 200,
    description: 'License status updated successfully',
    type: License,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
  })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateLicenseStatusDto,
  ): Promise<License> {
    return await this.licensesService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a license' })
  @ApiResponse({
    status: 200,
    description: 'License deleted successfully',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return await this.licensesService.remove(id);
  }
}