import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { toObjectId } from '../common/mongo-id.util';
import { ServiceOrder } from '../service-orders/service-order.entity';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/interfaces/audit-actor.interface';
import { UserRole } from '../auth/user.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(ServiceOrder)
    private serviceOrderRepository: Repository<ServiceOrder>,
    private auditService: AuditService,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const existing = await this.customerRepository.findOne({
      where: { email: createCustomerDto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const customer = this.customerRepository.create(createCustomerDto);
    return this.customerRepository.save(customer);
  }

  async findAll(includeInactive = false): Promise<Customer[]> {
    const customers = await this.customerRepository.find();
    return includeInactive
      ? customers
      : customers.filter((customer) => customer.isActive !== false);
  }

  async findOne(id: string): Promise<Customer> {
    const objectId = toObjectId(id);
    if (!objectId) {
      throw new NotFoundException(`Customer #${id} not found`);
    }

    const customer = await this.customerRepository.findOne({
      where: { _id: objectId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer #${id} not found`);
    }
    return customer;
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
    canChangeStatus = false,
  ): Promise<Customer> {
    const customer = await this.findOne(id);
    if (updateCustomerDto.isActive !== undefined && !canChangeStatus) {
      throw new ForbiddenException(
        'Solo administracion puede cambiar el estado del cliente.',
      );
    }
    if (updateCustomerDto.email && updateCustomerDto.email !== customer.email) {
      const existing = await this.customerRepository.findOne({
        where: { email: updateCustomerDto.email },
      });
      if (existing) {
        throw new ConflictException('Email already registered');
      }
    }
    Object.assign(customer, updateCustomerDto);
    return this.customerRepository.save(customer);
  }

  async remove(id: string): Promise<Customer> {
    const customer = await this.findOne(id);
    customer.isActive = false;
    return this.customerRepository.save(customer);
  }

  async deletePermanent(id: string, actor?: AuditActor): Promise<void> {
    if (actor?.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solo administracion puede eliminar clientes definitivamente.',
      );
    }
    const customer = await this.findOne(id);
    const associatedOrders = await this.serviceOrderRepository.count({
      where: { customerId: id },
    });
    if (associatedOrders > 0) {
      throw new ConflictException(
        `No se puede eliminar al cliente porque tiene ${associatedOrders} orden(es) asociada(s).`,
      );
    }

    await this.customerRepository.delete(customer._id ?? id);
    await this.auditService.record(
      'customer.deleted_permanently',
      'customer',
      customer.id ?? id,
      actor,
      {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        isActive: customer.isActive !== false,
        associatedOrders,
      },
    );
  }
}
