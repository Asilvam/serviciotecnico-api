import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { PrinterProfile } from '../interfaces/print-ticket-result.interface';

const PRINTER_PROFILES: PrinterProfile[] = ['thermal_escpos', 'system_pdf'];

export class PrintServiceOrderDto {
  @ApiPropertyOptional({
    enum: PRINTER_PROFILES,
    description:
      'Perfil de impresión. Si se omite, se usa PRINT_PROFILE de la API.',
  })
  @IsOptional()
  @IsIn(PRINTER_PROFILES)
  printerProfile?: PrinterProfile;
}
