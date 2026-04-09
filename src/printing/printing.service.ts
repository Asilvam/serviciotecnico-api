import { Injectable } from '@nestjs/common';
import type { PrintTicketResult } from './interfaces/print-ticket-result.interface';
import { ThermalTicketFormatter } from './thermal-ticket-formatter';
import type { ThermalTicketInput } from './thermal-ticket-formatter';

@Injectable()
export class PrintingService {
  constructor(private readonly thermalTicketFormatter: ThermalTicketFormatter) {}

  generate80mmTicket(payload: ThermalTicketInput): PrintTicketResult {
    const content = this.thermalTicketFormatter.format(payload);

    return {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      mimeType: 'text/plain',
      content,
      width: this.thermalTicketFormatter.getWidth(),
      paperWidthMm: this.thermalTicketFormatter.getPaperWidthMm(),
      generatedAt: new Date().toISOString(),
    };
  }
}
