import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { MongoRepository } from 'typeorm';
import { PrintJob } from './print-job.entity';
import type {
  PrinterProfile,
  PrintDispatchResult,
  PrintJobResult,
  PrintJobStatus,
} from './interfaces/print-ticket-result.interface';

type CreatePrintJobInput = {
  printerId: string;
  printerProfile: PrinterProfile;
  orderId: string;
  orderNumber: string;
};

const ACTIVE_STATUSES: PrintJobStatus[] = ['queued', 'printing'];

@Injectable()
export class PrintJobsService implements OnModuleInit {
  private readonly logger = new Logger(PrintJobsService.name);
  private readonly retentionMs = 30 * 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(PrintJob)
    private readonly printJobRepository: MongoRepository<PrintJob>,
  ) {}

  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.printJobRepository.createCollectionIndex(
        { jobId: 1 },
        { name: 'IDX_print_jobs_job_id', unique: true },
      ),
      this.printJobRepository.createCollectionIndex(
        { expiresAt: 1 },
        {
          name: 'IDX_print_jobs_expires_at',
          expireAfterSeconds: 0,
        },
      ),
    ]);
    this.logger.log('print_jobs.indexes_ready');
  }

  async create(input: CreatePrintJobInput): Promise<PrintJobResult> {
    const queuedAt = new Date();
    const job = this.printJobRepository.create({
      jobId: randomUUID(),
      printerId: input.printerId,
      printerProfile: input.printerProfile,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      status: 'queued',
      queuedAt,
      expiresAt: new Date(queuedAt.getTime() + this.retentionMs),
    });
    return this.toResult(await this.printJobRepository.save(job));
  }

  async findOne(jobId: string): Promise<PrintJobResult> {
    const job = await this.printJobRepository.findOne({ where: { jobId } });
    if (!job) {
      throw new NotFoundException('Trabajo de impresion no encontrado.');
    }
    return this.toResult(job);
  }

  async findActive(
    orderId: string,
    printerId: string,
    printerProfile: PrinterProfile,
  ): Promise<PrintJobResult | undefined> {
    const job = await this.printJobRepository.findOne({
      where: {
        orderId,
        printerId,
        printerProfile,
        status: { $in: ACTIVE_STATUSES },
      },
      order: { queuedAt: 'DESC' },
    });
    return job ? this.toResult(job) : undefined;
  }

  async markPrinting(jobId: string, printerId: string): Promise<void> {
    await this.transition(jobId, printerId, ['queued'], 'printing', {
      startedAt: new Date(),
    });
  }

  async markSentToPrinter(
    jobId: string,
    printerId: string,
    warnings: string[] = [],
  ): Promise<void> {
    await this.transition(
      jobId,
      printerId,
      ACTIVE_STATUSES,
      warnings.length > 0 ? 'sent_to_printer_with_warning' : 'sent_to_printer',
      {
        completedAt: new Date(),
        warnings,
      },
    );
  }

  async markFailed(
    jobId: string,
    printerId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    await this.transition(jobId, printerId, ACTIVE_STATUSES, 'failed', {
      completedAt: new Date(),
      errorCode,
      errorMessage,
    });
  }

  async markUnknown(
    jobId: string,
    printerId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    await this.transition(jobId, printerId, ACTIVE_STATUSES, 'unknown', {
      completedAt: new Date(),
      errorCode,
      errorMessage,
    });
  }

  async markActiveUnknownByPrinter(
    printerId: string,
    errorCode = 'AGENT_DISCONNECTED',
    errorMessage = 'El agente se desconecto con trabajos pendientes.',
  ): Promise<void> {
    await this.printJobRepository.updateMany(
      {
        printerId,
        status: { $in: ACTIVE_STATUSES },
      },
      {
        $set: {
          status: 'unknown',
          completedAt: new Date(),
          errorCode,
          errorMessage,
        },
      },
    );
  }

  toDispatchResult(job: PrintJobResult): PrintDispatchResult {
    return {
      jobId: job.jobId,
      printerId: job.printerId,
      printerProfile: job.printerProfile ?? 'thermal_escpos',
      orderId: job.orderId,
      orderNumber: job.orderNumber,
      status: job.status,
      queuedAt: job.queuedAt,
    };
  }

  private async transition(
    jobId: string,
    printerId: string,
    allowedStatuses: PrintJobStatus[],
    status: PrintJobStatus,
    changes: Record<string, unknown>,
  ): Promise<void> {
    const query = {
      jobId,
      printerId,
      status: { $in: allowedStatuses },
    };
    const update = {
      $set: {
        status,
        ...changes,
      },
    };
    await this.printJobRepository.updateOne(query, update);
  }

  private toResult(job: PrintJob): PrintJobResult {
    return {
      jobId: job.jobId,
      printerId: job.printerId,
      printerProfile: job.printerProfile ?? 'thermal_escpos',
      orderId: job.orderId,
      orderNumber: job.orderNumber,
      status: job.status,
      queuedAt: job.queuedAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      warnings: job.warnings ? [...job.warnings] : undefined,
    };
  }
}
