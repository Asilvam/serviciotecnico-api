import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PrinterProfile,
  PrintDispatchResult,
  PrintTicketResult,
  SystemPaperSize,
} from './interfaces/print-ticket-result.interface';
import { ThermalTicketFormatter } from './thermal-ticket-formatter';
import type { ThermalTicketInput } from './thermal-ticket-formatter';
import { PrintDispatchException, PrintGateway } from './print.gateway';
import { PrintJobsService } from './print-jobs.service';

const STATUS_LABELS: Record<string, string> = {
  pending: 'PENDIENTE',
  in_progress: 'EN PROCESO',
  waiting_parts: 'EN ESPERA DE REPUESTOS',
  completed: 'COMPLETADA',
  delivered: 'ENTREGADA',
  cancelled: 'CANCELADA',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'BAJA',
  medium: 'MEDIA',
  high: 'ALTA',
  urgent: 'URGENTE',
};

@Injectable()
export class PrintingService {
  private readonly logger = new Logger(PrintingService.name);

  constructor(
    private readonly thermalTicketFormatter: ThermalTicketFormatter,
    private readonly printGateway: PrintGateway,
    private readonly printJobsService: PrintJobsService,
    private readonly configService: ConfigService,
  ) {}

  async generateAndDispatch(
    payload: ThermalTicketInput,
    requestedProfile?: PrinterProfile,
  ): Promise<PrintDispatchResult> {
    const printerId = this.configService.get<string>(
      'DEFAULT_PRINTER_ID',
      'default-printer',
    );
    const configuredProfile = this.configService.get<string>(
      'PRINT_PROFILE',
      'thermal_escpos',
    );
    const printerProfile: PrinterProfile =
      requestedProfile ??
      (configuredProfile === 'system_pdf' ? 'system_pdf' : 'thermal_escpos');
    if (!this.printGateway.isPrinterConnected(printerId)) {
      throw new ServiceUnavailableException(
        'La impresora no esta disponible. Verifica que el agente este conectado.',
      );
    }

    const activeJob = await this.printJobsService.findActive(
      payload.orderId,
      printerId,
      printerProfile,
    );
    if (activeJob) {
      this.logger.warn(
        `print.active_job_reused jobId=${activeJob.jobId} orderId=${payload.orderId} printerId=${printerId} profile=${printerProfile}`,
      );
      return this.printJobsService.toDispatchResult(activeJob);
    }

    const job = await this.printJobsService.create({
      printerId,
      printerProfile,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
    });
    const ticket = this.generateTicket(
      payload,
      job.jobId,
      printerId,
      printerProfile,
    );

    try {
      await this.printGateway.dispatchToPrinter(printerId, ticket);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'El agente no pudo recibir el trabajo.';
      if (error instanceof PrintDispatchException && error.outcomeUncertain) {
        await this.printJobsService.markUnknown(
          job.jobId,
          printerId,
          'AGENT_ACK_TIMEOUT',
          message,
        );
        this.logger.warn(
          `print.unknown jobId=${job.jobId} orderId=${ticket.orderId} printerId=${printerId} profile=${printerProfile}`,
        );
        return this.printJobsService.toDispatchResult(
          await this.printJobsService.findOne(job.jobId),
        );
      }
      await this.printJobsService.markFailed(
        job.jobId,
        printerId,
        'AGENT_UNAVAILABLE',
        message,
      );
      throw error;
    }

    this.logger.log(
      `print.queued jobId=${job.jobId} orderId=${ticket.orderId} printerId=${printerId} profile=${printerProfile}`,
    );
    return this.printJobsService.toDispatchResult(job);
  }

  private generateTicket(
    payload: ThermalTicketInput,
    jobId: string,
    printerId: string,
    printerProfile: PrinterProfile,
  ): PrintTicketResult {
    const content = this.thermalTicketFormatter.format(payload);
    const trackingBaseUrl = this.configService
      .get<string>('PUBLIC_TRACKING_BASE_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');

    const configuredPaperSize = this.configService.get<string>(
      'SYSTEM_PAPER_SIZE',
      'LETTER',
    );
    const paperSize: SystemPaperSize =
      configuredPaperSize.toUpperCase() === 'LETTER' ? 'LETTER' : 'A4';
    const statusLabelEs = STATUS_LABELS[payload.status] ?? payload.status;

    return {
      type: 'service_order_ticket',
      jobId,
      printerId,
      printerProfile,
      ...(printerProfile === 'system_pdf' ? { paperSize } : {}),
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      mimeType: 'text/plain',
      content,
      width: this.thermalTicketFormatter.getWidth(),
      paperWidthMm: this.thermalTicketFormatter.getPaperWidthMm(),
      generatedAt: new Date().toISOString(),
      tracking: {
        url: `${trackingBaseUrl}/tracking/${payload.trackingToken}`,
        status: payload.status,
        statusLabelEs,
      },
      summary: {
        createdAt: payload.createdAt?.toISOString(),
        status: payload.status,
        statusLabelEs,
        priority: payload.priority,
        priorityLabelEs: PRIORITY_LABELS[payload.priority] ?? payload.priority,
        customerName: payload.customerName,
        technicianName: payload.technicianName,
        deviceType: payload.deviceType,
        deviceBrand: payload.deviceBrand,
        deviceModel: payload.deviceModel,
        serialNumber: payload.serialNumber,
        problemDescription: payload.problemDescription,
        diagnosis: payload.diagnosis,
        workDone: payload.workDone,
        laborCost: payload.laborCost ?? 0,
        partsCost: payload.partsCost ?? 0,
        totalCost: payload.totalCost ?? 0,
        estimatedDelivery: payload.estimatedDelivery?.toISOString(),
        deliveredAt: payload.deliveredAt?.toISOString(),
        items: payload.items.map((item) => ({ ...item })),
      },
    };
  }
}
