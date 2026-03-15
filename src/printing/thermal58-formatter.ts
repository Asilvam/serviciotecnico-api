import { Injectable } from '@nestjs/common';

export interface Thermal58TicketInput {
  orderId: string;
  orderNumber: string;
  createdAt?: Date;
  status: string;
  priority: string;
  customerId: string;
  customerName?: string;
  technicianId?: string;
  technicianName?: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel?: string;
  serialNumber?: string;
  problemDescription: string;
  diagnosis?: string;
  workDone?: string;
  laborCost?: number;
  partsCost?: number;
  totalCost?: number;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}

@Injectable()
export class Thermal58Formatter {
  private readonly width = 32;

  format(input: Thermal58TicketInput): string {
    const lines: string[] = [];

    lines.push(this.center('SERVICIO TECNICO'));
    lines.push(this.center('ORDEN DE SERVICIO'));
    lines.push(this.separator());
    lines.push(`Orden: ${input.orderNumber}`);
    lines.push(`ID: ${input.orderId}`);
    lines.push(`Fecha: ${this.formatDate(input.createdAt)}`);
    lines.push(`Estado: ${input.status}`);
    lines.push(`Prioridad: ${input.priority}`);
    lines.push(this.separator());

    lines.push('CLIENTE');
    lines.push(`- ${input.customerName ?? 'N/A'}`);
    lines.push(`- Id: ${input.customerId}`);

    lines.push('TECNICO');
    lines.push(`- ${input.technicianName ?? 'Sin asignar'}`);
    if (input.technicianId) {
      lines.push(`- Id: ${input.technicianId}`);
    }
    lines.push(this.separator());

    lines.push('EQUIPO');
    lines.push(`${input.deviceType} / ${input.deviceBrand}`);
    if (input.deviceModel) {
      lines.push(`Modelo: ${input.deviceModel}`);
    }
    if (input.serialNumber) {
      lines.push(`Serie: ${input.serialNumber}`);
    }
    lines.push(this.separator());

    lines.push('FALLA REPORTADA');
    lines.push(...this.wrap(input.problemDescription));

    if (input.diagnosis) {
      lines.push(this.separator());
      lines.push('DIAGNOSTICO');
      lines.push(...this.wrap(input.diagnosis));
    }

    if (input.workDone) {
      lines.push(this.separator());
      lines.push('TRABAJO REALIZADO');
      lines.push(...this.wrap(input.workDone));
    }

    lines.push(this.separator());
    lines.push('ITEMS');
    if (!input.items.length) {
      lines.push('Sin repuestos');
    } else {
      for (const item of input.items) {
        lines.push(...this.wrap(`${item.quantity} x ${item.productName}`));
        lines.push(this.right(`$${this.currency(item.unitPrice)} c/u`));
      }
    }

    lines.push(this.separator());
    lines.push(this.row('Mano de obra', `$${this.currency(input.laborCost ?? 0)}`));
    lines.push(this.row('Repuestos', `$${this.currency(input.partsCost ?? 0)}`));
    lines.push(this.row('TOTAL', `$${this.currency(input.totalCost ?? 0)}`));

    if (input.estimatedDelivery) {
      lines.push(`Entrega estimada: ${this.formatDate(input.estimatedDelivery)}`);
    }
    if (input.deliveredAt) {
      lines.push(`Entregado: ${this.formatDate(input.deliveredAt)}`);
    }

    lines.push(this.separator());
    lines.push(this.center('Gracias por su preferencia'));
    lines.push('\n\n');

    return lines.join('\n');
  }

  getWidth(): number {
    return this.width;
  }

  private separator(char = '-'): string {
    return char.repeat(this.width);
  }

  private center(text: string): string {
    const value = this.trim(text);
    if (value.length >= this.width) {
      return value;
    }
    const left = Math.floor((this.width - value.length) / 2);
    return `${' '.repeat(left)}${value}`;
  }

  private right(text: string): string {
    const value = this.trim(text);
    if (value.length >= this.width) {
      return value;
    }
    return `${' '.repeat(this.width - value.length)}${value}`;
  }

  private row(left: string, right: string): string {
    const leftValue = this.trim(left);
    const rightValue = this.trim(right);
    if (leftValue.length + rightValue.length + 1 > this.width) {
      return `${leftValue}\n${this.right(rightValue)}`;
    }
    const spaces = this.width - leftValue.length - rightValue.length;
    return `${leftValue}${' '.repeat(spaces)}${rightValue}`;
  }

  private wrap(text: string): string[] {
    const value = this.trim(text);
    if (!value) {
      return [''];
    }

    const words = value.split(/\s+/);
    const result: string[] = [];
    let current = '';

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= this.width) {
        current = next;
        continue;
      }
      if (current) {
        result.push(current);
      }
      current = word;
    }

    if (current) {
      result.push(current);
    }

    return result;
  }

  private trim(value?: string): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
  }

  private formatDate(date?: Date): string {
    if (!date) {
      return 'N/A';
    }
    return new Date(date).toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: false,
    });
  }

  private currency(value: number): string {
    return Math.round(value).toString();
  }
}

