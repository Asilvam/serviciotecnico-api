import { Module } from '@nestjs/common';
import { PrintingService } from './printing.service';
import { ThermalTicketFormatter } from './thermal-ticket-formatter';
import { PrintGateway } from './print.gateway';

@Module({
  providers: [PrintingService, ThermalTicketFormatter, PrintGateway],
  exports: [PrintingService, PrintGateway],
})
export class PrintingModule {}
