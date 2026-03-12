import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ServiceOrder,
  ServiceOrderItem,
  ServiceOrderStatus,
} from './service-order.entity';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';

@Injectable()
export class ServiceOrdersService {
  constructor(
    @InjectRepository(ServiceOrder)
    private serviceOrderRepository: Repository<ServiceOrder>,
    @InjectRepository(ServiceOrderItem)
    private serviceOrderItemRepository: Repository<ServiceOrderItem>,
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

    const savedOrder = await this.serviceOrderRepository.save(order);

    if (items && items.length > 0) {
      const orderItems = items.map((item) =>
        this.serviceOrderItemRepository.create({
          ...item,
          quantity: item.quantity || 1,
          serviceOrderId: savedOrder.id,
        }),
      );
      savedOrder.items = await this.serviceOrderItemRepository.save(orderItems);
    }

    return savedOrder;
  }

  async findAll(): Promise<ServiceOrder[]> {
    return this.serviceOrderRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<ServiceOrder> {
    const order = await this.serviceOrderRepository.findOne({ where: { id } });
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

  async findByCustomer(customerId: number): Promise<ServiceOrder[]> {
    return this.serviceOrderRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: number,
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

  async cancel(id: number): Promise<ServiceOrder> {
    const order = await this.findOne(id);
    order.status = ServiceOrderStatus.CANCELLED;
    return this.serviceOrderRepository.save(order);
  }
}
