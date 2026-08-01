import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrintJobsService } from './print-jobs.service';
import type { PrintJobResult } from './interfaces/print-ticket-result.interface';

@ApiTags('print-jobs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('print-jobs')
export class PrintJobsController {
  constructor(private readonly printJobsService: PrintJobsService) {}

  @Get(':jobId')
  @ApiOperation({ summary: 'Get the current status of a print job' })
  findOne(@Param('jobId') jobId: string): Promise<PrintJobResult> {
    return this.printJobsService.findOne(jobId);
  }
}
