import { NotFoundException } from '@nestjs/common';
import type { MongoRepository } from 'typeorm';
import { PrintJob } from './print-job.entity';
import { PrintJobsService } from './print-jobs.service';

const persistedJob: PrintJob = {
  jobId: 'job-1',
  printerId: 'reception-80mm',
  printerProfile: 'thermal_escpos',
  orderId: '67d0f4a5f99f719467f91a07',
  orderNumber: 'OT-0001',
  status: 'queued',
  queuedAt: new Date('2026-07-30T12:00:00.000Z'),
  expiresAt: new Date('2026-08-29T12:00:00.000Z'),
  createdAt: new Date('2026-07-30T12:00:00.000Z'),
  updatedAt: new Date('2026-07-30T12:00:00.000Z'),
};

describe('PrintJobsService', () => {
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    createCollectionIndex: jest.fn(),
  };
  let service: PrintJobsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PrintJobsService(
      repository as unknown as MongoRepository<PrintJob>,
    );
  });

  it('persists a queued print job with an expiration date', async () => {
    repository.create.mockReturnValue(persistedJob);
    repository.save.mockResolvedValue(persistedJob);

    const job = await service.create({
      printerId: persistedJob.printerId,
      printerProfile: persistedJob.printerProfile,
      orderId: persistedJob.orderId,
      orderNumber: persistedJob.orderNumber,
    });

    expect(job.status).toBe('queued');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        printerId: persistedJob.printerId,
        printerProfile: 'thermal_escpos',
        status: 'queued',
        queuedAt: expect.any(Date) as Date,
        expiresAt: expect.any(Date) as Date,
      }),
    );
    expect(repository.save).toHaveBeenCalledWith(persistedJob);
  });

  it('ensures unique and TTL indexes even when schema sync is disabled', async () => {
    repository.createCollectionIndex.mockResolvedValue('index-name');

    await service.onModuleInit();

    expect(repository.createCollectionIndex).toHaveBeenCalledTimes(2);
    expect(repository.createCollectionIndex).toHaveBeenCalledWith(
      { jobId: 1 },
      expect.objectContaining({ unique: true }),
    );
    expect(repository.createCollectionIndex).toHaveBeenCalledWith(
      { expiresAt: 1 },
      expect.objectContaining({ expireAfterSeconds: 0 }),
    );
  });

  it('uses guarded transitions and records an uncertain result', async () => {
    repository.updateOne.mockResolvedValue({ acknowledged: true });

    await service.markPrinting('job-1', 'reception-80mm');
    await service.markUnknown(
      'job-1',
      'reception-80mm',
      'USB_TRANSFER_FAILED',
      'Transfer interrupted',
    );

    expect(repository.updateOne).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        jobId: 'job-1',
        printerId: 'reception-80mm',
        status: { $in: ['queued'] },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'printing' }) as object,
      }),
    );
    expect(repository.updateOne).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: { $in: ['queued', 'printing'] },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'unknown',
          errorCode: 'USB_TRANSFER_FAILED',
        }) as object,
      }),
    );
  });

  it('reads a persisted job and rejects unknown job ids', async () => {
    repository.findOne.mockResolvedValueOnce(persistedJob);
    await expect(service.findOne('job-1')).resolves.toEqual(
      expect.objectContaining({
        jobId: 'job-1',
        queuedAt: '2026-07-30T12:00:00.000Z',
      }),
    );

    repository.findOne.mockResolvedValueOnce(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('finds an active job using a native MongoDB status query', async () => {
    repository.findOne.mockResolvedValue(persistedJob);

    await expect(
      service.findActive(
        persistedJob.orderId,
        persistedJob.printerId,
        persistedJob.printerProfile,
      ),
    ).resolves.toEqual(expect.objectContaining({ jobId: persistedJob.jobId }));
    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        orderId: persistedJob.orderId,
        printerId: persistedJob.printerId,
        printerProfile: persistedJob.printerProfile,
        status: { $in: ['queued', 'printing'] },
      },
      order: { queuedAt: 'DESC' },
    });
  });

  it('marks all active jobs unknown when the agent disconnects', async () => {
    repository.updateMany.mockResolvedValue({ acknowledged: true });

    await service.markActiveUnknownByPrinter('reception-80mm');

    expect(repository.updateMany).toHaveBeenCalledWith(
      {
        printerId: 'reception-80mm',
        status: { $in: ['queued', 'printing'] },
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'unknown',
          errorCode: 'AGENT_DISCONNECTED',
        }) as object,
      }),
    );
  });
});
