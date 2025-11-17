import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { LicensesService } from './licenses.service';

@ApiTags('licenses')
@Controller('licenses')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a license by ID' })
  @ApiParam({
    name: 'id',
    description: 'License ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'License retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'License not found',
  })
  findOne(@Param('id') id: string) {
    return this.licensesService.findOne(+id);
  }
}
