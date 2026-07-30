import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { ServiceOrderStatus } from './service-order.entity';
import { PrintingService } from '../printing/printing.service';
import type { ThermalTicketInput } from '../printing/thermal-ticket-formatter';
import type { PrintTicketResult } from '../printing/interfaces/print-ticket-result.interface';
import type { AuditActor } from '../audit/interfaces/audit-actor.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/user.entity';

@ApiTags('service-orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(
    private readonly serviceOrdersService: ServiceOrdersService,
    private readonly printingService: PrintingService,
  ) {}

  private getAuditActor(req: Request): AuditActor | undefined {
    const user = (
      req as Request & {
        user?: {
          id?: string;
          email?: string;
          role?: string;
          technicianId?: string;
        };
      }
    ).user;
    if (!user) {
      return undefined;
    }
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      technicianId: user.technicianId,
    };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({
    summary: 'Create a new service order (admin and receptionist)',
  })
  async create(
    @Body() createServiceOrderDto: CreateServiceOrderDto,
    @Req() req: Request,
  ) {
    const order = await this.serviceOrdersService.create(
      createServiceOrderDto,
      this.getAuditActor(req),
    );
    const orderId = order.id ?? '';
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const printEndpoint = `${baseUrl}/service-orders/${orderId}/print-80mm`;

    return {
      order,
      actions: {
        print80mm: {
          method: 'POST',
          url: printEndpoint,
        },
      },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all service orders' })
  @ApiQuery({ name: 'status', enum: ServiceOrderStatus, required: false })
  @ApiQuery({ name: 'customerId', type: String, required: false })
  findAll(
    @Req() req: Request,
    @Query('status') status?: ServiceOrderStatus,
    @Query('customerId') customerId?: string,
  ) {
    return this.serviceOrdersService.findVisible(
      this.getAuditActor(req),
      status,
      customerId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service order by ID' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.serviceOrdersService.findOneVisible(
      id,
      this.getAuditActor(req),
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Update service order (all roles)' })
  update(
    @Param('id') id: string,
    @Body() updateServiceOrderDto: UpdateServiceOrderDto,
    @Req() req: Request,
  ) {
    return this.serviceOrdersService.update(
      id,
      updateServiceOrderDto,
      this.getAuditActor(req),
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cancel service order (admin only)' })
  cancel(@Param('id') id: string, @Req() req: Request) {
    return this.serviceOrdersService.cancel(id, this.getAuditActor(req));
  }

  @Delete(':id/permanent')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Permanently delete service order (admin only)' })
  deletePermanent(@Param('id') id: string, @Req() req: Request) {
    return this.serviceOrdersService.deletePermanent(
      id,
      this.getAuditActor(req),
    );
  }

  @Post(':id/print-80mm')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({
    summary:
      'Generate and dispatch 80mm thermal ticket for a service order (all roles)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Service order ObjectId' })
  async print80mm(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<PrintTicketResult> {
    const payload: ThermalTicketInput =
      await this.serviceOrdersService.buildPrintPayload(
        id,
        this.getAuditActor(req),
      );
    return this.printingService.generateAndDispatch80mmTicket(payload);
  }
}
