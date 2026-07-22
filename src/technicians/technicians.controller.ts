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
import { TechniciansService } from './technicians.service';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/user.entity';
import type { AuditActor } from '../audit/interfaces/audit-actor.interface';

@ApiTags('technicians')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('technicians')
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

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
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new technician (admin only)' })
  create(@Body() createTechnicianDto: CreateTechnicianDto) {
    return this.techniciansService.create(createTechnicianDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Get all technicians (admin and receptionist)' })
  findAll(@Req() req: Request) {
    const role = (req as Request & { user?: { role?: UserRole } }).user?.role;
    return this.techniciansService.findAll(role === UserRole.ADMIN);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Get technician by ID (admin and receptionist)' })
  findOne(@Param('id') id: string) {
    return this.techniciansService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update technician (admin only)' })
  update(
    @Param('id') id: string,
    @Body() updateTechnicianDto: UpdateTechnicianDto,
  ) {
    return this.techniciansService.update(id, updateTechnicianDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate technician (admin only)' })
  remove(@Param('id') id: string) {
    return this.techniciansService.remove(id);
  }

  @Delete(':id/permanent')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Permanently delete technician (admin only)' })
  deletePermanent(@Param('id') id: string, @Req() req: Request) {
    return this.techniciansService.deletePermanent(id, this.getAuditActor(req));
  }
}
