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
import { Observable } from 'rxjs';
import { LicensesService } from './licenses.service';
import { LicensesUpdatesGateway } from './licenses-updates.gateway';
import { CreateLicenseDto, UpdateLicenseStatusDto } from './dto';

@Controller('api/licenses')
export class LicensesController {
  constructor(
    private readonly licensesService: LicensesService,
    private readonly updatesGateway: LicensesUpdatesGateway,
  ) {}

  @Post()
  create(@Body() createLicenseDto: CreateLicenseDto) {
    return this.licensesService.create(createLicenseDto);
  }

  @Get()
  findAll() {
    return this.licensesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.licensesService.findOne(id);
  }

  @Get('track/:trackId')
  findByTrackId(@Param('trackId') trackId: string) {
    return this.licensesService.findByTrackId(trackId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateLicenseStatusDto: UpdateLicenseStatusDto,
  ) {
    return this.licensesService.updateStatus(id, updateLicenseStatusDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.licensesService.remove(id);
  }

  @Sse('updates/stream')
  updates(): Observable<MessageEvent> {
    return this.updatesGateway.getLicenseUpdates();
  }
}
