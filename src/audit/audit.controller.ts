import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { UserRole } from '../auth/user.entity';
import { AuditService } from './audit.service';
import type { AuditLog } from './audit-log.entity';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  private ensureAdmin(req: Request): void {
    const user = (req as Request & { user?: { role?: string } }).user;
    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo admin puede ver logs');
    }
  }

  @Get()
  @ApiOperation({ summary: 'List audit logs (admin only)' })
  @ApiQuery({ name: 'entity', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('entity') entity: string | undefined,
    @Query('action') action: string | undefined,
    @Query('entityId') entityId: string | undefined,
    @Query('userId') userId: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: Request,
  ): Promise<AuditLog[]> {
    this.ensureAdmin(req);

    return this.auditService.findLogs({
      entity,
      action,
      entityId,
      userId,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
