import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '../auth/user.entity';
import { AuditService } from './audit.service';
import type { AuditLog } from './audit-log.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN) // Sólo administradores pueden ver logs de auditoría
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

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
  ): Promise<AuditLog[]> {
    return this.auditService.findLogs({
      entity,
      action,
      entityId,
      userId,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
