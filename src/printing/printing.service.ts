import { Injectable } from '@nestjs/common';
import type { Print58Result } from './interfaces/print58-result.interface';
import { Thermal58Formatter } from './thermal58-formatter';
import type { Thermal58TicketInput } from './thermal58-formatter';

@Injectable()
export class PrintingService {
  constructor(private readonly thermal58Formatter: Thermal58Formatter) {}

  generate58mmTicket(payload: Thermal58TicketInput): Print58Result {
    const content = this.thermal58Formatter.format(payload);

    return {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      mimeType: 'text/plain',
      content,
      width: this.thermal58Formatter.getWidth(),
      generatedAt: new Date().toISOString(),
    };
  }
}

