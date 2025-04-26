import { Controller, Patch, Param, Body, Get, Post } from '@nestjs/common';
import { LicenseStatusService } from './license-status.service';
import { LicenseStatus, Status } from '../entities/license-status.entity';

@Controller('license-status')
export class LicenseStatusController {
  constructor(private readonly licenseStatusService: LicenseStatusService) {}

  @Get()
  findAll(): Promise<LicenseStatus[]> {
    return this.licenseStatusService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.licenseStatusService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body('status') status: Status) {
    return this.licenseStatusService.updateStatus(Number(id), status);
  }

  @Post()
  create(@Body() body: Partial<LicenseStatus>) {
    return this.licenseStatusService.create(body);
  }
}
