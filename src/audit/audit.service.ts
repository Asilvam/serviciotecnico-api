import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import type { AuditActor } from './interfaces/audit-actor.interface';

interface AuditLogFilters {
  entity?: string;
  action?: string;
  entityId?: string;
  userId?: string;
  limit?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async record(action: string, entity: string, entityId: string, actor?: AuditActor, metadata?: Record<string, unknown>): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create({
        action,
        entity,
        entityId,
        userId: actor?.userId,
        userEmail: actor?.email,
        userRole: actor?.role,
        metadata,
      });
      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      // Do not block business flow if audit persistence fails.
      this.logger.warn(`audit.record_failed action=${action} entity=${entity} entityId=${entityId}`);
      this.logger.debug(error instanceof Error ? error.message : 'unknown-error');
    }
  }

  async findLogs(filters: AuditLogFilters): Promise<AuditLog[]> {
    const { entity, action, entityId, userId } = filters;
    const where: Record<string, unknown> = {};

    if (entity) {
      where.entity = entity;
    }
    if (action) {
      where.action = action;
    }
    if (entityId) {
      where.entityId = entityId;
    }
    if (userId) {
      where.userId = userId;
    }

    const requestedLimit = Number.isFinite(filters.limit) ? Number(filters.limit) : 50;
    const limit = Math.min(Math.max(requestedLimit, 1), 200);

    return this.auditLogRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
