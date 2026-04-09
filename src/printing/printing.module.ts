import { Module } from '@nestjs/common';
import { PrintingService } from './printing.service';
import { ThermalTicketFormatter } from './thermal-ticket-formatter';

@Module({
  providers: [PrintingService, ThermalTicketFormatter],
  exports: [PrintingService],
})
export class PrintingModule {}
