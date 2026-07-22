import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ServiceOrder,
  ServiceOrderItem,
  ServiceOrderStatus,
} from './service-order.entity';
import {
  CreateServiceOrderDto,
  ServiceOrderItemDto,
} from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { toObjectId } from '../common/mongo-id.util';
import { Customer } from '../customers/customer.entity';
import { Technician } from '../technicians/technician.entity';
import type { ThermalTicketInput } from '../printing/thermal-ticket-formatter';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/interfaces/audit-actor.interface';
import { Product, ProductType } from '../products/product.entity';
import { UserRole } from '../auth/user.entity';

type InventoryPlan = {
  items: ServiceOrderItem[];
  changes: Array<{ product: Product; previousStock: number }>;
};

export type ServiceOrderView = ServiceOrder & {
  customerName?: string;
  technicianName?: string;
};

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
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private auditService: AuditService,
  ) {}

  private getActorRole(actor?: AuditActor): UserRole {
    if (
      !actor?.role ||
      !Object.values(UserRole).includes(actor.role as UserRole)
    ) {
      throw new ForbiddenException(
        'No fue posible validar el rol del usuario.',
      );
    }
    return actor.role as UserRole;
  }

  private assertTechnicianCanAccess(
    order: ServiceOrder,
    actor?: AuditActor,
  ): void {
    if (!actor?.technicianId) {
      throw new ForbiddenException(
        'El usuario tecnico no esta vinculado a un perfil tecnico.',
      );
    }
    if (order.technicianId !== actor.technicianId) {
      throw new ForbiddenException(
        'Solo puedes acceder a ordenes que tienes asignadas.',
      );
    }
  }

  private sanitizeAllowedFields(
    order: ServiceOrder,
    dto: UpdateServiceOrderDto,
    allowedFields: Set<keyof UpdateServiceOrderDto>,
  ): UpdateServiceOrderDto {
    const fields = Object.keys(dto) as Array<keyof UpdateServiceOrderDto>;
    const allowedEntries = fields
      .filter((field) => allowedFields.has(field))
      .map((field) => [field, dto[field]]);
    const changedAllowedFields = fields.filter(
      (field) =>
        allowedFields.has(field) &&
        !this.valuesAreEquivalent(field, order, dto),
    );
    const forbiddenFields = fields.filter(
      (field) =>
        !allowedFields.has(field) &&
        !this.valuesAreEquivalent(field, order, dto),
    );
    if (forbiddenFields.length > 0 && changedAllowedFields.length === 0) {
      throw new ForbiddenException(
        `No tienes permisos para modificar: ${forbiddenFields.join(', ')}.`,
      );
    }
    if (forbiddenFields.length > 0) {
      this.logger.warn(
        `service_order.update_fields_ignored fields=${forbiddenFields.join(',')}`,
      );
    }
    return Object.fromEntries(allowedEntries) as UpdateServiceOrderDto;
  }

  private valuesAreEquivalent(
    field: keyof UpdateServiceOrderDto,
    order: ServiceOrder,
    dto: UpdateServiceOrderDto,
  ): boolean {
    const currentValue = order[field as keyof ServiceOrder] as unknown;
    const requestedValue = dto[field] as unknown;

    if (
      (currentValue === null ||
        currentValue === undefined ||
        currentValue === '') &&
      (requestedValue === null ||
        requestedValue === undefined ||
        requestedValue === '')
    ) {
      return true;
    }
    if (field === 'estimatedDelivery') {
      const currentTime = new Date(currentValue as string | Date).getTime();
      const requestedTime = new Date(requestedValue as string | Date).getTime();
      return (
        Number.isFinite(currentTime) &&
        Number.isFinite(requestedTime) &&
        currentTime === requestedTime
      );
    }
    return JSON.stringify(currentValue) === JSON.stringify(requestedValue);
  }

  private validateUpdatePermissions(
    order: ServiceOrder,
    dto: UpdateServiceOrderDto,
    actor?: AuditActor,
  ): UpdateServiceOrderDto {
    const role = this.getActorRole(actor);
    if (role === UserRole.ADMIN) {
      if (dto.status === ServiceOrderStatus.CANCELLED) {
        throw new BadRequestException(
          'Usa la accion de cancelacion para restaurar correctamente el stock.',
        );
      }
      return dto;
    }

    if (role === UserRole.RECEPTIONIST) {
      const managementFields = new Set<keyof UpdateServiceOrderDto>();
      if (
        [
          ServiceOrderStatus.PENDING,
          ServiceOrderStatus.IN_PROGRESS,
          ServiceOrderStatus.WAITING_PARTS,
        ].includes(order.status)
      ) {
        managementFields.add('technicianId');
        managementFields.add('priority');
        managementFields.add('estimatedDelivery');
      }
      if (order.status === ServiceOrderStatus.PENDING) {
        [
          'customerId',
          'deviceType',
          'deviceBrand',
          'deviceModel',
          'serialNumber',
          'problemDescription',
        ].forEach((field) =>
          managementFields.add(field as keyof UpdateServiceOrderDto),
        );
      }
      if (
        order.status === ServiceOrderStatus.COMPLETED &&
        dto.status === ServiceOrderStatus.DELIVERED
      ) {
        managementFields.add('status');
      }
      if (
        dto.status &&
        dto.status !== order.status &&
        dto.status !== ServiceOrderStatus.DELIVERED
      ) {
        throw new ForbiddenException(
          'Recepcion solo puede marcar como entregada una orden completada.',
        );
      }
      return this.sanitizeAllowedFields(order, dto, managementFields);
    }

    this.assertTechnicianCanAccess(order, actor);
    if (
      [
        ServiceOrderStatus.COMPLETED,
        ServiceOrderStatus.DELIVERED,
        ServiceOrderStatus.CANCELLED,
      ].includes(order.status)
    ) {
      throw new ForbiddenException(
        'La orden ya no admite modificaciones tecnicas.',
      );
    }
    const allowedFields = new Set<keyof UpdateServiceOrderDto>([
      'diagnosis',
      'workDone',
      'items',
      'status',
    ]);
    if (dto.status && dto.status !== order.status) {
      const allowedTransitions: Partial<
        Record<ServiceOrderStatus, ServiceOrderStatus[]>
      > = {
        [ServiceOrderStatus.PENDING]: [ServiceOrderStatus.IN_PROGRESS],
        [ServiceOrderStatus.IN_PROGRESS]: [
          ServiceOrderStatus.WAITING_PARTS,
          ServiceOrderStatus.COMPLETED,
        ],
        [ServiceOrderStatus.WAITING_PARTS]: [
          ServiceOrderStatus.IN_PROGRESS,
          ServiceOrderStatus.COMPLETED,
        ],
      };
      if (!(allowedTransitions[order.status] ?? []).includes(dto.status)) {
        throw new ForbiddenException(
          `No puedes cambiar la orden de ${order.status} a ${dto.status}.`,
        );
      }
    }
    return this.sanitizeAllowedFields(order, dto, allowedFields);
  }

  private async prepareInventoryPlan(
    currentItems: ServiceOrderItem[],
    requestedItems: ServiceOrderItemDto[],
  ): Promise<InventoryPlan> {
    this.ensureUniqueItems(requestedItems);
    const currentQuantities = new Map(
      (currentItems ?? []).map((item) => [item.productId, item.quantity || 1]),
    );
    const requestedQuantities = new Map(
      requestedItems.map((item) => [item.productId, item.quantity || 1]),
    );
    const productIds = new Set([
      ...currentQuantities.keys(),
      ...requestedQuantities.keys(),
    ]);
    const products = new Map<string, Product>();
    const changes: InventoryPlan['changes'] = [];

    for (const productId of productIds) {
      const objectId = toObjectId(productId);
      if (!objectId) {
        throw new BadRequestException(`Producto ${productId} no valido.`);
      }
      const product = await this.productRepository.findOne({
        where: { _id: objectId },
      });
      if (
        !product ||
        (!product.isActive && requestedQuantities.has(productId))
      ) {
        throw new BadRequestException(
          `El producto ${productId} no existe o esta inactivo.`,
        );
      }

      const previousStock = product.stock ?? 0;
      const tracksStock =
        (product.type ?? ProductType.PART) === ProductType.PART;
      const quantityDelta = tracksStock
        ? (requestedQuantities.get(productId) ?? 0) -
          (currentQuantities.get(productId) ?? 0)
        : 0;
      if (tracksStock && quantityDelta > previousStock) {
        throw new BadRequestException(
          `Stock insuficiente para ${product.name}. Disponible: ${previousStock}.`,
        );
      }
      product.stock = tracksStock ? previousStock - quantityDelta : 0;
      products.set(productId, product);
      if (quantityDelta !== 0) {
        changes.push({ product, previousStock });
      }
    }

    return {
      items: requestedItems.map((item) => {
        const product = products.get(item.productId);
        if (!product) {
          throw new BadRequestException(
            `No fue posible resolver el producto ${item.productId}.`,
          );
        }
        return {
          productId: item.productId,
          productName: product.name,
          unitPrice: product.price,
          quantity: item.quantity || 1,
        };
      }),
      changes,
    };
  }

  private async saveInventoryPlan(plan: InventoryPlan): Promise<void> {
    for (const change of plan.changes) {
      await this.productRepository.save(change.product);
    }
  }

  private async rollbackInventoryPlan(plan: InventoryPlan): Promise<void> {
    for (const change of plan.changes) {
      change.product.stock = change.previousStock;
      await this.productRepository.save(change.product);
    }
  }

  private async attachDisplayNames(
    order: ServiceOrder,
  ): Promise<ServiceOrderView> {
    const view = order as ServiceOrderView;
    const customerObjectId = toObjectId(order.customerId);
    const technicianObjectId = order.technicianId
      ? toObjectId(order.technicianId)
      : undefined;

    const [customer, technician] = await Promise.all([
      customerObjectId
        ? this.customerRepository.findOne({ where: { _id: customerObjectId } })
        : Promise.resolve(null),
      technicianObjectId
        ? this.technicianRepository.findOne({
            where: { _id: technicianObjectId },
          })
        : Promise.resolve(null),
    ]);

    view.customerName = customer?.name;
    view.technicianName = technician?.name;
    return view;
  }

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

  private ensureUniqueItems(items: { productId: string }[]): void {
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.productId) {
        throw new BadRequestException('Cada item debe incluir productId.');
      }
      if (seen.has(item.productId)) {
        throw new BadRequestException('No se permiten items duplicados.');
      }
      seen.add(item.productId);
    }
  }

  async create(
    createServiceOrderDto: CreateServiceOrderDto,
    actor?: AuditActor,
  ): Promise<ServiceOrder> {
    const { items, ...orderData } = createServiceOrderDto;
    const role = this.getActorRole(actor);
    if (role === UserRole.RECEPTIONIST && items && items.length > 0) {
      throw new ForbiddenException(
        'Los repuestos se registran durante el trabajo tecnico.',
      );
    }

    const inventoryPlan = await this.prepareInventoryPlan([], items ?? []);

    const order = this.serviceOrderRepository.create({
      ...orderData,
      orderNumber: this.generateOrderNumber(),
      status: ServiceOrderStatus.PENDING,
    });

    if (inventoryPlan.items.length > 0) {
      const partsCost = inventoryPlan.items.reduce(
        (sum, item) => sum + item.unitPrice * (item.quantity || 1),
        0,
      );
      order.partsCost = partsCost;
      order.totalCost = partsCost + (order.laborCost || 0);
    }

    order.items = inventoryPlan.items;

    await this.saveInventoryPlan(inventoryPlan);
    let savedOrder: ServiceOrder;
    try {
      savedOrder = await this.serviceOrderRepository.save(order);
    } catch (error) {
      await this.rollbackInventoryPlan(inventoryPlan);
      throw error;
    }
    this.logger.log(
      `service_order.created orderId=${savedOrder.id ?? 'unknown'} orderNumber=${savedOrder.orderNumber}`,
    );
    await this.auditService.record(
      'service_order.created',
      'service_order',
      savedOrder.id ?? 'unknown',
      actor,
      {
        orderNumber: savedOrder.orderNumber,
        status: savedOrder.status,
        customerId: savedOrder.customerId,
      },
    );

    return this.attachDisplayNames(savedOrder);
  }

  async findAll(): Promise<ServiceOrder[]> {
    return this.serviceOrderRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findVisible(
    actor?: AuditActor,
    status?: ServiceOrderStatus,
    customerId?: string,
  ): Promise<ServiceOrderView[]> {
    const role = this.getActorRole(actor);
    const where: Partial<ServiceOrder> = {};
    if (status) {
      where.status = status;
    }
    if (customerId) {
      where.customerId = customerId;
    }
    if (role === UserRole.TECHNICIAN) {
      if (!actor?.technicianId) {
        throw new ForbiddenException(
          'El usuario tecnico no esta vinculado a un perfil tecnico.',
        );
      }
      where.technicianId = actor.technicianId;
    }
    const orders = await this.serviceOrderRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return Promise.all(orders.map((order) => this.attachDisplayNames(order)));
  }

  async findOne(id: string): Promise<ServiceOrder> {
    const objectId = toObjectId(id);
    if (!objectId) {
      this.logger.warn(`service_order.find_one.invalid_id id=${id}`);
      throw new NotFoundException(`Service Order #${id} not found`);
    }

    const order = await this.serviceOrderRepository.findOne({
      where: { _id: objectId },
    });
    if (!order) {
      this.logger.warn(`service_order.find_one.not_found id=${id}`);
      throw new NotFoundException(`Service Order #${id} not found`);
    }
    return order;
  }

  async findOneVisible(
    id: string,
    actor?: AuditActor,
  ): Promise<ServiceOrderView> {
    const order = await this.findOne(id);
    if (this.getActorRole(actor) === UserRole.TECHNICIAN) {
      this.assertTechnicianCanAccess(order, actor);
    }
    return this.attachDisplayNames(order);
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
    actor?: AuditActor,
  ): Promise<ServiceOrder> {
    const order = await this.findOne(id);
    const permittedUpdate = this.validateUpdatePermissions(
      order,
      updateServiceOrderDto,
      actor,
    );
    const previousStatus = order.status;
    const { items, ...updateData } = permittedUpdate;
    Object.assign(order, updateData);

    if (permittedUpdate.laborCost !== undefined) {
      order.totalCost = (permittedUpdate.laborCost || 0) + order.partsCost;
    }

    let inventoryPlan: InventoryPlan | undefined;
    if (items) {
      inventoryPlan = await this.prepareInventoryPlan(order.items ?? [], items);
      const partsCost = inventoryPlan.items.reduce(
        (sum, item) => sum + item.unitPrice * (item.quantity || 1),
        0,
      );
      order.items = inventoryPlan.items;
      order.partsCost = partsCost;
      order.totalCost = (order.laborCost || 0) + partsCost;
    }

    if (permittedUpdate.status === ServiceOrderStatus.DELIVERED) {
      order.deliveredAt = new Date();
    }

    if (inventoryPlan) {
      await this.saveInventoryPlan(inventoryPlan);
    }
    let savedOrder: ServiceOrder;
    try {
      savedOrder = await this.serviceOrderRepository.save(order);
    } catch (error) {
      if (inventoryPlan) {
        await this.rollbackInventoryPlan(inventoryPlan);
      }
      throw error;
    }
    this.logger.log(
      `service_order.updated orderId=${savedOrder.id ?? id} status=${previousStatus}->${savedOrder.status}`,
    );
    await this.auditService.record(
      'service_order.updated',
      'service_order',
      savedOrder.id ?? id,
      actor,
      {
        previousStatus,
        currentStatus: savedOrder.status,
        fields: Object.keys(permittedUpdate),
      },
    );
    return this.attachDisplayNames(savedOrder);
  }

  async cancel(id: string, actor?: AuditActor): Promise<ServiceOrder> {
    const order = await this.findOne(id);
    if (this.getActorRole(actor) !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solo administracion puede cancelar ordenes.',
      );
    }
    if (order.status === ServiceOrderStatus.CANCELLED) {
      throw new BadRequestException('La orden ya esta cancelada.');
    }
    if (order.status === ServiceOrderStatus.DELIVERED) {
      throw new BadRequestException(
        'Una orden entregada no puede ser cancelada.',
      );
    }
    const inventoryPlan = await this.prepareInventoryPlan(
      order.items ?? [],
      [],
    );
    order.status = ServiceOrderStatus.CANCELLED;
    await this.saveInventoryPlan(inventoryPlan);
    let savedOrder: ServiceOrder;
    try {
      savedOrder = await this.serviceOrderRepository.save(order);
    } catch (error) {
      await this.rollbackInventoryPlan(inventoryPlan);
      throw error;
    }
    this.logger.log(`service_order.cancelled orderId=${savedOrder.id ?? id}`);
    await this.auditService.record(
      'service_order.cancelled',
      'service_order',
      savedOrder.id ?? id,
      actor,
      {
        status: savedOrder.status,
      },
    );
    return savedOrder;
  }

  async buildPrintPayload(
    id: string,
    actor?: AuditActor,
  ): Promise<ThermalTicketInput> {
    const order = await this.findOneVisible(id, actor);

    let customerName: string | undefined;
    const customerObjectId = toObjectId(order.customerId);
    if (customerObjectId) {
      const customer = await this.customerRepository.findOne({
        where: { _id: customerObjectId },
      });
      customerName = customer?.name;
    } else {
      this.logger.warn(
        `service_order.print_payload.customer_id_invalid orderId=${order.id ?? id}`,
      );
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
        this.logger.warn(
          `service_order.print_payload.technician_id_invalid orderId=${order.id ?? id}`,
        );
      }
    }

    this.logger.log(
      `service_order.print_payload_built orderId=${order.id ?? id}`,
    );
    await this.auditService.record(
      'service_order.print_payload_built',
      'service_order',
      order.id ?? id,
      actor,
      {
        orderNumber: order.orderNumber,
        status: order.status,
      },
    );

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
