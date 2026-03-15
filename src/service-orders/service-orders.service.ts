import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceOrder, ServiceOrderStatus } from './service-order.entity';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { toObjectId } from '../common/mongo-id.util';
import { Customer } from '../customers/customer.entity';
import { Technician } from '../technicians/technician.entity';
import type { Thermal58TicketInput } from '../printing/thermal58-formatter';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/interfaces/audit-actor.interface';

@Injectable()
export class ServiceOrdersService {
  private readonly logger = new Logger(ServiceOrdersService.name);

  constructor(
    @InjectRepository(ServiceOrder)
    private serviceOrderRepository: Repository<ServiceOrder>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Technician)
    private technicianRepository: Repository<Technician>,
    private auditService: AuditService,
  ) {}

  private generateOrderNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `OT-${year}${month}${day}-${random}`;
  }

  async create(createServiceOrderDto: CreateServiceOrderDto, actor?: AuditActor): Promise<ServiceOrder> {
    const { items, ...orderData } = createServiceOrderDto;

    const order = this.serviceOrderRepository.create({
      ...orderData,
      orderNumber: this.generateOrderNumber(),
      status: ServiceOrderStatus.PENDING,
    });

    if (items && items.length > 0) {
      const partsCost = items.reduce((sum, item) => sum + item.unitPrice * (item.quantity || 1), 0);
      order.partsCost = partsCost;
      order.totalCost = partsCost + (order.laborCost || 0);
    }

    order.items = (items || []).map((item) => ({
      ...item,
      quantity: item.quantity || 1,
    }));

    const savedOrder = await this.serviceOrderRepository.save(order);
    this.logger.log(`service_order.created orderId=${savedOrder.id ?? 'unknown'} orderNumber=${savedOrder.orderNumber}`);
    await this.auditService.record('service_order.created', 'service_order', savedOrder.id ?? 'unknown', actor, {
      orderNumber: savedOrder.orderNumber,
      status: savedOrder.status,
      customerId: savedOrder.customerId,
    });
    return savedOrder;
  }

  async findAll(): Promise<ServiceOrder[]> {
    return this.serviceOrderRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ServiceOrder> {
    const objectId = toObjectId(id);
    if (!objectId) {
      this.logger.warn(`service_order.find_one.invalid_id id=${id}`);
      throw new NotFoundException(`Service Order #${id} not found`);
    }

    const order = await this.serviceOrderRepository.findOne({ where: { _id: objectId } });
    if (!order) {
      this.logger.warn(`service_order.find_one.not_found id=${id}`);
      throw new NotFoundException(`Service Order #${id} not found`);
    }
    return order;
  }

  async findByStatus(status: ServiceOrderStatus): Promise<ServiceOrder[]> {
    return this.serviceOrderRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  async findByCustomer(customerId: string): Promise<ServiceOrder[]> {
    return this.serviceOrderRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateServiceOrderDto: UpdateServiceOrderDto, actor?: AuditActor): Promise<ServiceOrder> {
    const order = await this.findOne(id);
    const previousStatus = order.status;
    Object.assign(order, updateServiceOrderDto);

    if (updateServiceOrderDto.laborCost !== undefined) {
      order.totalCost = (updateServiceOrderDto.laborCost || 0) + order.partsCost;
    }

    if (updateServiceOrderDto.status === ServiceOrderStatus.DELIVERED) {
      order.deliveredAt = new Date();
    }

    const savedOrder = await this.serviceOrderRepository.save(order);
    this.logger.log(`service_order.updated orderId=${savedOrder.id ?? id} status=${previousStatus}->${savedOrder.status}`);
    await this.auditService.record('service_order.updated', 'service_order', savedOrder.id ?? id, actor, {
      previousStatus,
      currentStatus: savedOrder.status,
      fields: Object.keys(updateServiceOrderDto),
    });
    return savedOrder;
  }

  async cancel(id: string, actor?: AuditActor): Promise<ServiceOrder> {
    const order = await this.findOne(id);
    order.status = ServiceOrderStatus.CANCELLED;
    const savedOrder = await this.serviceOrderRepository.save(order);
    this.logger.log(`service_order.cancelled orderId=${savedOrder.id ?? id}`);
    await this.auditService.record('service_order.cancelled', 'service_order', savedOrder.id ?? id, actor, {
      status: savedOrder.status,
    });
    return savedOrder;
  }

  async buildPrintPayload(id: string, actor?: AuditActor): Promise<Thermal58TicketInput> {
    const order = await this.findOne(id);

    let customerName: string | undefined;
    const customerObjectId = toObjectId(order.customerId);
    if (customerObjectId) {
      const customer = await this.customerRepository.findOne({
        where: { _id: customerObjectId },
      });
      customerName = customer?.name;
    } else {
      this.logger.warn(`service_order.print_payload.customer_id_invalid orderId=${order.id ?? id}`);
    }

    let technicianName: string | undefined;
    if (order.technicianId) {
      const technicianObjectId = toObjectId(order.technicianId);
      if (technicianObjectId) {
        const technician = await this.technicianRepository.findOne({
          where: { _id: technicianObjectId },
        });
        technicianName = technician?.name;
      } else {
        this.logger.warn(`service_order.print_payload.technician_id_invalid orderId=${order.id ?? id}`);
      }
    }

    this.logger.log(`service_order.print_payload_built orderId=${order.id ?? id}`);
    await this.auditService.record('service_order.print_payload_built', 'service_order', order.id ?? id, actor, {
      orderNumber: order.orderNumber,
      status: order.status,
    });

    return {
      orderId: order.id ?? id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      priority: order.priority,
      customerId: order.customerId,
      customerName,
      technicianId: order.technicianId,
      technicianName,
      deviceType: order.deviceType,
      deviceBrand: order.deviceBrand,
      deviceModel: order.deviceModel,
      serialNumber: order.serialNumber,
      problemDescription: order.problemDescription,
      diagnosis: order.diagnosis,
      workDone: order.workDone,
      laborCost: order.laborCost,
      partsCost: order.partsCost,
      totalCost: order.totalCost,
      estimatedDelivery: order.estimatedDelivery,
      deliveredAt: order.deliveredAt,
      items: (order.items || []).map((item) => ({
        productName: item.productName,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
      })),
    };
  }
}
