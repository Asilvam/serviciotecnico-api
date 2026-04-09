import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { ServiceOrderStatus } from './service-order.entity';
import { PrintingService } from '../printing/printing.service';
import type { ThermalTicketInput } from '../printing/thermal-ticket-formatter';
import type { PrintTicketResult } from '../printing/interfaces/print-ticket-result.interface';
import type { AuditActor } from '../audit/interfaces/audit-actor.interface';

@ApiTags('service-orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(
    private readonly serviceOrdersService: ServiceOrdersService,
    private readonly printingService: PrintingService,
  ) {}

  private getAuditActor(req: Request): AuditActor | undefined {
    const user = (req as Request & { user?: { id?: string; email?: string; role?: string } }).user;
    if (!user) {
      return undefined;
    }
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new service order' })
  async create(@Body() createServiceOrderDto: CreateServiceOrderDto, @Req() req: Request) {
    const order = await this.serviceOrdersService.create(createServiceOrderDto, this.getAuditActor(req));
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
  findAll(@Query('status') status?: ServiceOrderStatus, @Query('customerId') customerId?: string) {
    if (status) {
      return this.serviceOrdersService.findByStatus(status);
    }
    if (customerId) {
      return this.serviceOrdersService.findByCustomer(customerId);
    }
    return this.serviceOrdersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service order by ID' })
  findOne(@Param('id') id: string) {
    return this.serviceOrdersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update service order' })
  update(@Param('id') id: string, @Body() updateServiceOrderDto: UpdateServiceOrderDto, @Req() req: Request) {
    return this.serviceOrdersService.update(id, updateServiceOrderDto, this.getAuditActor(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel service order' })
  cancel(@Param('id') id: string, @Req() req: Request) {
    return this.serviceOrdersService.cancel(id, this.getAuditActor(req));
  }

  @Post(':id/print-80mm')
  @ApiOperation({ summary: 'Generate 80mm thermal ticket for a service order' })
  @ApiParam({ name: 'id', type: String, description: 'Service order ObjectId' })
  async print80mm(@Param('id') id: string, @Req() req: Request): Promise<PrintTicketResult> {
    const payload: ThermalTicketInput = await this.serviceOrdersService.buildPrintPayload(id, this.getAuditActor(req));
    return this.printingService.generate80mmTicket(payload);
  }
}
