import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Technician } from './technician.entity';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';
import { toObjectId } from '../common/mongo-id.util';
import { ServiceOrder } from '../service-orders/service-order.entity';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/interfaces/audit-actor.interface';
import { UserRole } from '../auth/user.entity';

@Injectable()
export class TechniciansService {
  constructor(
    @InjectRepository(Technician)
    private technicianRepository: Repository<Technician>,
    @InjectRepository(ServiceOrder)
    private serviceOrderRepository: Repository<ServiceOrder>,
    private auditService: AuditService,
  ) {}

  async create(createTechnicianDto: CreateTechnicianDto): Promise<Technician> {
    const existing = await this.technicianRepository.findOne({
      where: { email: createTechnicianDto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const technician = this.technicianRepository.create(createTechnicianDto);
    return this.technicianRepository.save(technician);
  }

  async findAll(includeInactive = false): Promise<Technician[]> {
    const technicians = await this.technicianRepository.find();
    return includeInactive
      ? technicians
      : technicians.filter((technician) => technician.isActive !== false);
  }

  async findOne(id: string): Promise<Technician> {
    const objectId = toObjectId(id);
    if (!objectId) {
      throw new NotFoundException(`Technician #${id} not found`);
    }

    const technician = await this.technicianRepository.findOne({
      where: { _id: objectId },
    });
    if (!technician) {
      throw new NotFoundException(`Technician #${id} not found`);
    }
    return technician;
  }

  async update(
    id: string,
    updateTechnicianDto: UpdateTechnicianDto,
  ): Promise<Technician> {
    const technician = await this.findOne(id);
    if (
      updateTechnicianDto.email &&
      updateTechnicianDto.email !== technician.email
    ) {
      const existing = await this.technicianRepository.findOne({
        where: { email: updateTechnicianDto.email },
      });
      if (existing) {
        throw new ConflictException('Email already registered');
      }
    }
    Object.assign(technician, updateTechnicianDto);
    return this.technicianRepository.save(technician);
  }

  async remove(id: string): Promise<void> {
    const technician = await this.findOne(id);
    technician.isActive = false;
    await this.technicianRepository.save(technician);
  }

  async deletePermanent(id: string, actor?: AuditActor): Promise<void> {
    if (actor?.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solo administracion puede eliminar tecnicos definitivamente.',
      );
    }

    const technician = await this.findOne(id);
    const associatedOrders = await this.serviceOrderRepository.count({
      where: { technicianId: id },
    });
    if (associatedOrders > 0) {
      throw new ConflictException(
        `No se puede eliminar al tecnico porque tiene ${associatedOrders} orden(es) asociada(s).`,
      );
    }

    await this.technicianRepository.delete(technician._id ?? id);
    await this.auditService.record(
      'technician.deleted_permanently',
      'technician',
      technician.id ?? id,
      actor,
      {
        name: technician.name,
        email: technician.email,
        phone: technician.phone,
        specialty: technician.specialty,
        isActive: technician.isActive !== false,
        associatedOrders,
      },
    );
  }
}
