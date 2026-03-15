import { Module } from '@nestjs/common';
import { PrintingService } from './printing.service';
import { Thermal58Formatter } from './thermal58-formatter';

@Module({
  providers: [PrintingService, Thermal58Formatter],
  exports: [PrintingService],
})
export class PrintingModule {}
