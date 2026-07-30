import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/user.entity';
import type { AuditActor } from '../audit/interfaces/audit-actor.interface';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  private getAuditActor(req: Request): AuditActor | undefined {
    const user = (
      req as Request & {
        user?: { id?: string; email?: string; role?: string };
      }
    ).user;
    return user
      ? { userId: user.id, email: user.email, role: user.role }
      : undefined;
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Create a new customer (admin and receptionist)' })
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Get all customers (admin and receptionist)' })
  findAll(@Req() req: Request) {
    const role = (req as Request & { user?: { role?: UserRole } }).user?.role;
    return this.customersService.findAll(role === UserRole.ADMIN);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Get customer by ID (admin and receptionist)' })
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Update customer (admin and receptionist)' })
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Req() req: Request,
  ) {
    const role = (req as Request & { user?: { role?: UserRole } }).user?.role;
    return this.customersService.update(
      id,
      updateCustomerDto,
      role === UserRole.ADMIN,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate customer (admin only)' })
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Delete(':id/permanent')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Permanently delete customer (admin only)' })
  deletePermanent(@Param('id') id: string, @Req() req: Request) {
    return this.customersService.deletePermanent(id, this.getAuditActor(req));
  }
}
