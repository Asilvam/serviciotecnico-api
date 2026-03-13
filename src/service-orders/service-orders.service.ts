import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ServiceOrder,
  ServiceOrderStatus,
} from './service-order.entity';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { toObjectId } from '../common/mongo-id.util';

@Injectable()
export class ServiceOrdersService {
  constructor(
    @InjectRepository(ServiceOrder)
    private serviceOrderRepository: Repository<ServiceOrder>,
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

  async create(createServiceOrderDto: CreateServiceOrderDto): Promise<ServiceOrder> {
    const { items, ...orderData } = createServiceOrderDto;

    const order = this.serviceOrderRepository.create({
      ...orderData,
      orderNumber: this.generateOrderNumber(),
      status: ServiceOrderStatus.PENDING,
    });

    if (items && items.length > 0) {
      const partsCost = items.reduce(
        (sum, item) => sum + item.unitPrice * (item.quantity || 1),
        0,
      );
      order.partsCost = partsCost;
      order.totalCost = partsCost + (order.laborCost || 0);
    }

    order.items = (items || []).map((item) => ({
      ...item,
      quantity: item.quantity || 1,
    }));

    return this.serviceOrderRepository.save(order);
  }

  async findAll(): Promise<ServiceOrder[]> {
    return this.serviceOrderRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ServiceOrder> {
    const objectId = toObjectId(id);
    if (!objectId) {
      throw new NotFoundException(`Service Order #${id} not found`);
    }

    const order = await this.serviceOrderRepository.findOne({ where: { _id: objectId } });
    if (!order) {
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

  async update(
    id: string,
    updateServiceOrderDto: UpdateServiceOrderDto,
  ): Promise<ServiceOrder> {
    const order = await this.findOne(id);
    Object.assign(order, updateServiceOrderDto);

    if (updateServiceOrderDto.laborCost !== undefined) {
      order.totalCost = (updateServiceOrderDto.laborCost || 0) + order.partsCost;
    }

    if (updateServiceOrderDto.status === ServiceOrderStatus.DELIVERED) {
      order.deliveredAt = new Date();
    }

    return this.serviceOrderRepository.save(order);
  }

  async cancel(id: string): Promise<ServiceOrder> {
    const order = await this.findOne(id);
    order.status = ServiceOrderStatus.CANCELLED;
    return this.serviceOrderRepository.save(order);
  }
}
