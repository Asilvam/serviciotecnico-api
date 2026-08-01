import { Module } from '@nestjs/common';
import { PrintingService } from './printing.service';
import { ThermalTicketFormatter } from './thermal-ticket-formatter';
import { PrintGateway } from './print.gateway';
import { PrintJobsService } from './print-jobs.service';
import { PrintJobsController } from './print-jobs.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrintJob } from './print-job.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PrintJob])],
  controllers: [PrintJobsController],
  providers: [
    PrintingService,
    ThermalTicketFormatter,
    PrintGateway,
    PrintJobsService,
  ],
  exports: [PrintingService, PrintGateway, PrintJobsService],
})
export class PrintingModule {}
