import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { PrintingService } from './printing.service';
import { ThermalTicketFormatter } from './thermal-ticket-formatter';
import { PrintJobsService } from './print-jobs.service';
import { PrintDispatchException, type PrintGateway } from './print.gateway';
import type { PrintJobResult } from './interfaces/print-ticket-result.interface';

const thermalInput = {
  orderId: '67d0f4a5f99f719467f91a07',
  orderNumber: 'OT-0001',
  trackingToken: 'signed-token',
  status: 'in_progress',
  priority: 'medium',
  customerId: '67d0f4a5f99f719467f91a02',
  deviceType: 'Notebook',
  deviceBrand: 'Lenovo',
  problemDescription: 'No enciende',
  items: [],
};

describe('PrintingService', () => {
  const queuedJob: PrintJobResult = {
    jobId: 'job-1',
    printerId: 'reception-80mm',
    printerProfile: 'thermal_escpos',
    orderId: thermalInput.orderId,
    orderNumber: thermalInput.orderNumber,
    status: 'queued',
    queuedAt: '2026-07-30T12:00:00.000Z',
  };

  function createPrintJobsMock(result: PrintJobResult = queuedJob) {
    return {
      create: jest.fn().mockResolvedValue(queuedJob),
      findActive: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      markUnknown: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(result),
      toDispatchResult: jest.fn().mockReturnValue(result),
    } as unknown as PrintJobsService;
  }

  it('rejects the request before creating a job when the agent is offline', async () => {
    const gateway = {
      isPrinterConnected: jest.fn().mockReturnValue(false),
      dispatchToPrinter: jest.fn(),
    } as unknown as PrintGateway;
    const jobs = createPrintJobsMock();
    const service = new PrintingService(
      new ThermalTicketFormatter(),
      gateway,
      jobs,
      new ConfigService({ DEFAULT_PRINTER_ID: 'reception-80mm' }),
    );
    const createSpy = jest.spyOn(jobs, 'create');

    await expect(service.generateAndDispatch(thermalInput)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('dispatches a correlated job with public tracking information', async () => {
    const dispatchToPrinter = jest.fn().mockResolvedValue({
      accepted: true,
      jobId: 'acknowledged-job',
    });
    const gateway = {
      isPrinterConnected: jest.fn().mockReturnValue(true),
      dispatchToPrinter,
    } as unknown as PrintGateway;
    const jobs = createPrintJobsMock();
    const service = new PrintingService(
      new ThermalTicketFormatter(),
      gateway,
      jobs,
      new ConfigService({
        DEFAULT_PRINTER_ID: 'reception-80mm',
        PUBLIC_TRACKING_BASE_URL: 'https://st.example.com/',
      }),
    );

    const result = await service.generateAndDispatch(thermalInput);

    expect(result).toEqual(
      expect.objectContaining({
        printerId: 'reception-80mm',
        status: 'queued',
      }),
    );
    expect(dispatchToPrinter).toHaveBeenCalledWith(
      'reception-80mm',
      expect.objectContaining({
        type: 'service_order_ticket',
        jobId: result.jobId,
        printerProfile: 'thermal_escpos',
        tracking: {
          url: 'https://st.example.com/tracking/signed-token',
          status: 'in_progress',
          statusLabelEs: 'EN PROCESO',
        },
      }),
    );
  });

  it('reuses an active job instead of dispatching a duplicate ticket', async () => {
    const dispatchToPrinter = jest.fn();
    const gateway = {
      isPrinterConnected: jest.fn().mockReturnValue(true),
      dispatchToPrinter,
    } as unknown as PrintGateway;
    const jobs = createPrintJobsMock();
    const findActiveSpy = jest
      .spyOn(jobs, 'findActive')
      .mockResolvedValue(queuedJob);
    const createSpy = jest.spyOn(jobs, 'create');
    const service = new PrintingService(
      new ThermalTicketFormatter(),
      gateway,
      jobs,
      new ConfigService({ DEFAULT_PRINTER_ID: 'reception-80mm' }),
    );

    await expect(service.generateAndDispatch(thermalInput)).resolves.toEqual(
      expect.objectContaining({ jobId: queuedJob.jobId }),
    );
    expect(findActiveSpy).toHaveBeenCalledWith(
      queuedJob.orderId,
      queuedJob.printerId,
      queuedJob.printerProfile,
    );
    expect(createSpy).not.toHaveBeenCalled();
    expect(dispatchToPrinter).not.toHaveBeenCalled();
  });

  it('marks the job failed when ticket generation throws', async () => {
    const gateway = {
      isPrinterConnected: jest.fn().mockReturnValue(true),
      dispatchToPrinter: jest.fn(),
    } as unknown as PrintGateway;
    const jobs = createPrintJobsMock();
    const markFailedSpy = jest.spyOn(jobs, 'markFailed');
    const formatter = {
      format: jest.fn(() => {
        throw new Error('Invalid ticket date');
      }),
      getWidth: jest.fn().mockReturnValue(40),
      getPaperWidthMm: jest.fn().mockReturnValue(80),
    } as unknown as ThermalTicketFormatter;
    const service = new PrintingService(
      formatter,
      gateway,
      jobs,
      new ConfigService({ DEFAULT_PRINTER_ID: 'reception-80mm' }),
    );

    await expect(service.generateAndDispatch(thermalInput)).rejects.toThrow(
      'Invalid ticket date',
    );
    expect(markFailedSpy).toHaveBeenCalledWith(
      queuedJob.jobId,
      queuedJob.printerId,
      'TICKET_GENERATION_FAILED',
      'Invalid ticket date',
    );
  });

  it('returns an unknown job instead of claiming failure after an acknowledgement timeout', async () => {
    const unknownJob: PrintJobResult = {
      ...queuedJob,
      status: 'unknown',
      errorCode: 'AGENT_ACK_TIMEOUT',
      errorMessage: 'Agent acknowledgement timeout',
    };
    const gateway = {
      isPrinterConnected: jest.fn().mockReturnValue(true),
      dispatchToPrinter: jest
        .fn()
        .mockRejectedValue(
          new PrintDispatchException('Agent acknowledgement timeout', true),
        ),
    } as unknown as PrintGateway;
    const jobs = createPrintJobsMock(unknownJob);
    const markUnknownSpy = jest.spyOn(jobs, 'markUnknown');
    const service = new PrintingService(
      new ThermalTicketFormatter(),
      gateway,
      jobs,
      new ConfigService({ DEFAULT_PRINTER_ID: 'reception-80mm' }),
    );

    await expect(service.generateAndDispatch(thermalInput)).resolves.toEqual(
      expect.objectContaining({ status: 'unknown' }),
    );
    expect(markUnknownSpy).toHaveBeenCalledWith(
      queuedJob.jobId,
      queuedJob.printerId,
      'AGENT_ACK_TIMEOUT',
      'Agent acknowledgement timeout',
    );
  });

  it('dispatches a structured Letter summary by default for the system printer profile', async () => {
    const dispatchToPrinter = jest.fn().mockResolvedValue({
      accepted: true,
      jobId: 'job-1',
    });
    const gateway = {
      isPrinterConnected: jest.fn().mockReturnValue(true),
      dispatchToPrinter,
    } as unknown as PrintGateway;
    const systemJob: PrintJobResult = {
      ...queuedJob,
      printerId: 'default-printer',
      printerProfile: 'system_pdf',
    };
    const jobs = createPrintJobsMock(systemJob);
    jest.spyOn(jobs, 'create').mockResolvedValue(systemJob);
    jest.spyOn(jobs, 'toDispatchResult').mockReturnValue(systemJob);
    const service = new PrintingService(
      new ThermalTicketFormatter(),
      gateway,
      jobs,
      new ConfigService({
        DEFAULT_PRINTER_ID: 'default-printer',
        PRINT_PROFILE: 'thermal_escpos',
        PUBLIC_TRACKING_BASE_URL: 'https://st.example.com',
      }),
    );

    const result = await service.generateAndDispatch(
      {
        ...thermalInput,
        customerName: 'Cliente Ejemplo',
        diagnosis: 'Fuente de poder defectuosa',
        createdAt: '2026-08-02T09:39:43.000Z',
        estimatedDelivery: '2026-08-15',
        laborCost: 20000,
        partsCost: 15000,
        totalCost: 35000,
        items: [
          { productName: 'Fuente de poder', quantity: 1, unitPrice: 15000 },
        ],
      },
      'system_pdf',
    );

    expect(result).toEqual(
      expect.objectContaining({
        printerId: 'default-printer',
        printerProfile: 'system_pdf',
      }),
    );
    expect(dispatchToPrinter).toHaveBeenCalledWith(
      'default-printer',
      expect.objectContaining({
        printerProfile: 'system_pdf',
        paperSize: 'LETTER',
        summary: expect.objectContaining({
          customerName: 'Cliente Ejemplo',
          diagnosis: 'Fuente de poder defectuosa',
          createdAt: '2026-08-02T09:39:43.000Z',
          estimatedDelivery: '2026-08-15',
          totalCost: 35000,
          items: [
            {
              productName: 'Fuente de poder',
              quantity: 1,
              unitPrice: 15000,
            },
          ],
        }) as object,
      }),
    );
  });
});
