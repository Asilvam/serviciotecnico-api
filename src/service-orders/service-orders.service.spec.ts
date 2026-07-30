import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { ServiceOrdersService } from './service-orders.service';
import {
  ServiceOrder,
  ServiceOrderStatus,
  ServiceOrderPriority,
} from './service-order.entity';
import { Customer } from '../customers/customer.entity';
import { Technician } from '../technicians/technician.entity';
import { AuditService } from '../audit/audit.service';
import { Product, ProductType } from '../products/product.entity';
import { UserRole } from '../auth/user.entity';
import { createTrackingToken } from './tracking-token.util';
import { ConfigService } from '@nestjs/config';

const mockOrder: ServiceOrder = {
  id: '67d0f4a5f99f719467f91a07',
  orderNumber: 'OT-20250101-0001',
  customerId: '67d0f4a5f99f719467f91a02',
  technicianId: '',
  deviceType: 'Laptop',
  deviceBrand: 'HP',
  deviceModel: 'Pavilion 15',
  serialNumber: 'ABC123',
  problemDescription: 'No enciende',
  diagnosis: '',
  workDone: '',
  status: ServiceOrderStatus.PENDING,
  priority: ServiceOrderPriority.MEDIUM,
  laborCost: 0,
  partsCost: 0,
  totalCost: 0,
  items: [],
  estimatedDelivery: new Date(),
  deliveredAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockOrderRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

const mockCustomerRepository = {
  findOne: jest.fn(),
};

const mockTechnicianRepository = {
  findOne: jest.fn(),
};

const mockProductRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockAuditService = {
  record: jest.fn().mockResolvedValue(undefined),
};

const mockConfigService = {
  getOrThrow: jest.fn((key: string) =>
    key === 'TRACKING_RETENTION_DAYS' ? 30 : 'test-tracking-secret',
  ),
};

const adminActor = { role: UserRole.ADMIN, userId: 'admin-id' };
const receptionistActor = {
  role: UserRole.RECEPTIONIST,
  userId: 'reception-id',
};

describe('ServiceOrdersService', () => {
  let service: ServiceOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceOrdersService,
        {
          provide: getRepositoryToken(ServiceOrder),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(Customer),
          useValue: mockCustomerRepository,
        },
        {
          provide: getRepositoryToken(Technician),
          useValue: mockTechnicianRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ServiceOrdersService>(ServiceOrdersService);
    jest.clearAllMocks();
    mockOrderRepository.findOne.mockResolvedValue(mockOrder);
    mockCustomerRepository.findOne.mockResolvedValue({ name: 'Cliente Test' });
    mockTechnicianRepository.findOne.mockResolvedValue({
      name: 'Tecnico Test',
    });
    mockProductRepository.findOne.mockResolvedValue({
      name: 'Pantalla LCD',
      price: 25000,
      stock: 10,
      type: ProductType.PART,
      isActive: true,
    });
    mockProductRepository.save.mockImplementation((product) =>
      Promise.resolve(product),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a service order', async () => {
      mockOrderRepository.create.mockReturnValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);

      const result = await service.create(
        {
          customerId: '67d0f4a5f99f719467f91a02',
          deviceType: 'Laptop',
          deviceBrand: 'HP',
          problemDescription: 'No enciende',
        },
        adminActor,
      );

      expect(result).toBeDefined();
      expect(result.customerId).toBe('67d0f4a5f99f719467f91a02');
      expect(mockAuditService.record).toHaveBeenCalled();
    });

    it('should reject an inactive customer when creating an order', async () => {
      mockCustomerRepository.findOne.mockResolvedValue({
        name: 'Cliente inactivo',
        isActive: false,
      });

      await expect(
        service.create(
          {
            customerId: '67d0f4a5f99f719467f91a02',
            deviceType: 'Laptop',
            deviceBrand: 'HP',
            problemDescription: 'No enciende',
          },
          adminActor,
        ),
      ).rejects.toThrow('El cliente no existe o no esta disponible.');

      expect(mockOrderRepository.save).not.toHaveBeenCalled();
    });

    it('should reject an inactive technician when creating an order', async () => {
      mockTechnicianRepository.findOne.mockResolvedValue({
        name: 'Tecnico inactivo',
        isActive: false,
      });

      await expect(
        service.create(
          {
            customerId: '67d0f4a5f99f719467f91a02',
            technicianId: '67d0f4a5f99f719467f91a03',
            deviceType: 'Laptop',
            deviceBrand: 'HP',
            problemDescription: 'No enciende',
          },
          adminActor,
        ),
      ).rejects.toThrow('El tecnico no existe o no esta disponible.');

      expect(mockOrderRepository.save).not.toHaveBeenCalled();
    });

    it('should calculate parts cost and total cost when items are provided', async () => {
      const orderWithItems = {
        ...mockOrder,
        partsCost: 50000,
        totalCost: 50000,
      };
      mockOrderRepository.create.mockReturnValue({ ...mockOrder });
      mockOrderRepository.save.mockResolvedValue(orderWithItems);
      const result = await service.create(
        {
          customerId: '67d0f4a5f99f719467f91a02',
          deviceType: 'Laptop',
          deviceBrand: 'HP',
          problemDescription: 'No enciende',
          items: [
            {
              productId: '67d0f4a5f99f719467f91a04',
              productName: 'Precio manipulado',
              unitPrice: 1,
              quantity: 2,
            },
          ],
        },
        adminActor,
      );

      expect(result).toBeDefined();
      expect(mockProductRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ stock: 8 }),
      );
    });

    it('should add services without changing stock', async () => {
      mockOrderRepository.create.mockReturnValue({ ...mockOrder });
      mockOrderRepository.save.mockImplementation((value) =>
        Promise.resolve(value),
      );
      mockProductRepository.findOne.mockResolvedValue({
        name: 'Diagnostico tecnico',
        price: 15000,
        stock: 0,
        type: ProductType.SERVICE,
        isActive: true,
      });

      const result = await service.create(
        {
          customerId: '67d0f4a5f99f719467f91a02',
          deviceType: 'Notebook',
          deviceBrand: 'Apple',
          problemDescription: 'No enciende',
          items: [
            {
              productId: '67d0f4a5f99f719467f91a04',
              productName: 'Dato cliente ignorado',
              unitPrice: 1,
              quantity: 2,
            },
          ],
        },
        adminActor,
      );

      expect(result.partsCost).toBe(30000);
      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all service orders', async () => {
      mockOrderRepository.find.mockResolvedValue([mockOrder]);
      const result = await service.findAll();
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('role visibility', () => {
    it('should filter the list by the linked technician', async () => {
      const technicianId = '67d0f4a5f99f719467f91a03';
      mockOrderRepository.find.mockResolvedValue([
        { ...mockOrder, technicianId },
      ]);

      await service.findVisible({
        role: UserRole.TECHNICIAN,
        userId: 'tech-user',
        technicianId,
      });

      const [findOptions] = mockOrderRepository.find.mock.calls[0] as [
        { where: Partial<ServiceOrder> },
      ];
      expect(findOptions.where.technicianId).toBe(technicianId);
    });

    it('should reject access to an order assigned to another technician', async () => {
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        technicianId: '67d0f4a5f99f719467f91a03',
      });

      await expect(
        service.findOneVisible('67d0f4a5f99f719467f91a07', {
          role: UserRole.TECHNICIAN,
          userId: 'tech-user',
          technicianId: '67d0f4a5f99f719467f91a04',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('should return a service order by id', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      const result = await service.findOne('67d0f4a5f99f719467f91a07');
      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if not found', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('67d0f4a5f99f719467f91aff')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a service order', async () => {
      const order = { ...mockOrder };
      mockOrderRepository.findOne.mockResolvedValue(order);
      mockOrderRepository.save.mockImplementation((o) => Promise.resolve(o));

      const result = await service.cancel(
        '67d0f4a5f99f719467f91a07',
        adminActor,
      );
      expect(result.status).toBe(ServiceOrderStatus.CANCELLED);
    });

    it('should reject cancellation by receptionist', async () => {
      mockOrderRepository.findOne.mockResolvedValue({ ...mockOrder });

      await expect(
        service.cancel('67d0f4a5f99f719467f91a07', receptionistActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return the current order when it is already cancelled', async () => {
      const order = { ...mockOrder, status: ServiceOrderStatus.CANCELLED };
      mockOrderRepository.findOne.mockResolvedValue(order);

      const result = await service.cancel(
        '67d0f4a5f99f719467f91a07',
        adminActor,
      );

      expect(result.status).toBe(ServiceOrderStatus.CANCELLED);
      expect(mockOrderRepository.save).not.toHaveBeenCalled();
    });

    it('should restore item stock when an order is cancelled', async () => {
      const order = {
        ...mockOrder,
        items: [
          {
            productId: '67d0f4a5f99f719467f91a04',
            productName: 'Pantalla LCD',
            unitPrice: 25000,
            quantity: 2,
          },
        ],
      };
      const product = {
        name: 'Pantalla LCD',
        price: 25000,
        stock: 8,
        isActive: true,
      };
      mockOrderRepository.findOne.mockResolvedValue(order);
      mockOrderRepository.save.mockImplementation((value) =>
        Promise.resolve(value),
      );
      mockProductRepository.findOne.mockResolvedValue(product);

      await service.cancel('67d0f4a5f99f719467f91a07', adminActor);

      expect(mockProductRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ stock: 10 }),
      );
    });

    it('should not change stock when cancelling an order with a service', async () => {
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        items: [
          {
            productId: '67d0f4a5f99f719467f91a04',
            productName: 'Diagnostico tecnico',
            unitPrice: 15000,
            quantity: 1,
          },
        ],
      });
      mockOrderRepository.save.mockImplementation((value) =>
        Promise.resolve(value),
      );
      mockProductRepository.findOne.mockResolvedValue({
        name: 'Diagnostico tecnico',
        price: 15000,
        stock: 0,
        type: ProductType.SERVICE,
        isActive: true,
      });

      await service.cancel('67d0f4a5f99f719467f91a07', adminActor);

      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deletePermanent', () => {
    it('should permanently delete any order and record an audit log', async () => {
      const order = { ...mockOrder };
      mockOrderRepository.findOne.mockResolvedValue(order);
      mockOrderRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deletePermanent('67d0f4a5f99f719467f91a07', adminActor);

      expect(mockOrderRepository.delete).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        'service_order.deleted_permanently',
        'service_order',
        expect.any(String),
        adminActor,
        expect.objectContaining({
          orderNumber: order.orderNumber,
          status: order.status,
          inventoryRestored: true,
        }),
      );
    });

    it('should reject permanent deletion by receptionist', async () => {
      mockOrderRepository.findOne.mockResolvedValue({ ...mockOrder });

      await expect(
        service.deletePermanent('67d0f4a5f99f719467f91a07', receptionistActor),
      ).rejects.toThrow(ForbiddenException);

      expect(mockOrderRepository.delete).not.toHaveBeenCalled();
    });

    it('should restore stock when permanently deleting an active order', async () => {
      const order = {
        ...mockOrder,
        status: ServiceOrderStatus.IN_PROGRESS,
        items: [
          {
            productId: '67d0f4a5f99f719467f91a04',
            productName: 'Pantalla LCD',
            unitPrice: 25000,
            quantity: 2,
          },
        ],
      };
      mockOrderRepository.findOne.mockResolvedValue(order);
      mockOrderRepository.delete.mockResolvedValue({ affected: 1 });
      mockProductRepository.findOne.mockResolvedValue({
        name: 'Pantalla LCD',
        price: 25000,
        stock: 8,
        type: ProductType.PART,
        isActive: true,
      });

      await service.deletePermanent('67d0f4a5f99f719467f91a07', adminActor);

      expect(mockProductRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ stock: 10 }),
      );
    });

    it('should not restore stock when permanently deleting a delivered order', async () => {
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        status: ServiceOrderStatus.DELIVERED,
        items: [
          {
            productId: '67d0f4a5f99f719467f91a04',
            productName: 'Pantalla LCD',
            unitPrice: 25000,
            quantity: 2,
          },
        ],
      });
      mockOrderRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deletePermanent('67d0f4a5f99f719467f91a07', adminActor);

      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });

    it('should delete an order when a referenced product no longer exists', async () => {
      const missingProductId = '69b3c55504eff17505169560';
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        status: ServiceOrderStatus.IN_PROGRESS,
        items: [
          {
            productId: missingProductId,
            productName: 'Repuesto antiguo',
            unitPrice: 5000,
            quantity: 1,
          },
        ],
      });
      mockProductRepository.findOne.mockResolvedValue(null);
      mockOrderRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deletePermanent('67d0f4a5f99f719467f91a07', adminActor);

      expect(mockOrderRepository.delete).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        'service_order.deleted_permanently',
        'service_order',
        expect.any(String),
        adminActor,
        expect.objectContaining({
          inventoryRestored: false,
          inventoryRestoreSkippedProductIds: [missingProductId],
        }),
      );
    });
  });

  describe('update permissions', () => {
    it('should apply and audit only fields that actually changed for admin', async () => {
      const order = { ...mockOrder };
      mockOrderRepository.findOne.mockResolvedValue(order);
      mockOrderRepository.save.mockImplementation((value) =>
        Promise.resolve(value),
      );

      const result = await service.update(
        '67d0f4a5f99f719467f91a07',
        {
          deviceBrand: order.deviceBrand,
          problemDescription: order.problemDescription,
          status: ServiceOrderStatus.IN_PROGRESS,
        },
        adminActor,
      );

      expect(result.status).toBe(ServiceOrderStatus.IN_PROGRESS);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        'service_order.updated',
        'service_order',
        expect.any(String),
        adminActor,
        expect.objectContaining({ fields: ['status'] }),
      );
    });

    it('should let reception correct intake data while pending', async () => {
      const order = { ...mockOrder };
      mockOrderRepository.findOne.mockResolvedValue(order);
      mockOrderRepository.save.mockImplementation((value) =>
        Promise.resolve(value),
      );

      const result = await service.update(
        '67d0f4a5f99f719467f91a07',
        { deviceBrand: 'Dell', technicianId: null },
        receptionistActor,
      );

      expect(result.deviceBrand).toBe('Dell');
      expect(result.technicianId).toBe('');
    });

    it('should reject assigning an inactive technician while updating an order', async () => {
      const order = { ...mockOrder };
      mockOrderRepository.findOne.mockResolvedValue(order);
      mockTechnicianRepository.findOne.mockResolvedValue({
        name: 'Tecnico inactivo',
        isActive: false,
      });

      await expect(
        service.update(
          '67d0f4a5f99f719467f91a07',
          { technicianId: '67d0f4a5f99f719467f91a03' },
          adminActor,
        ),
      ).rejects.toThrow('El tecnico no existe o no esta disponible.');

      expect(mockOrderRepository.save).not.toHaveBeenCalled();
    });

    it('should reject technical fields from reception', async () => {
      mockOrderRepository.findOne.mockResolvedValue({ ...mockOrder });

      await expect(
        service.update(
          '67d0f4a5f99f719467f91a07',
          { diagnosis: 'Falla en placa' },
          receptionistActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should let the assigned technician advance technical work', async () => {
      const technicianId = '67d0f4a5f99f719467f91a03';
      const order = {
        ...mockOrder,
        technicianId,
        status: ServiceOrderStatus.IN_PROGRESS,
      };
      mockOrderRepository.findOne.mockResolvedValue(order);
      mockOrderRepository.save.mockImplementation((value) =>
        Promise.resolve(value),
      );

      const result = await service.update(
        '67d0f4a5f99f719467f91a07',
        {
          customerId: order.customerId,
          technicianId,
          deviceType: order.deviceType,
          deviceBrand: order.deviceBrand,
          deviceModel: order.deviceModel,
          serialNumber: order.serialNumber,
          problemDescription: order.problemDescription,
          priority: order.priority,
          laborCost: order.laborCost,
          estimatedDelivery: order.estimatedDelivery.toISOString(),
          diagnosis: 'Falla en placa',
          status: ServiceOrderStatus.COMPLETED,
        },
        {
          role: UserRole.TECHNICIAN,
          userId: 'tech-user',
          technicianId,
        },
      );

      expect(result.status).toBe(ServiceOrderStatus.COMPLETED);
      expect(result.diagnosis).toBe('Falla en placa');
    });

    it('should ignore an intake change when a valid technical change is present', async () => {
      const technicianId = '67d0f4a5f99f719467f91a03';
      const order = {
        ...mockOrder,
        technicianId,
        status: ServiceOrderStatus.PENDING,
      };
      mockOrderRepository.findOne.mockResolvedValue(order);
      mockOrderRepository.save.mockImplementation((value) =>
        Promise.resolve(value),
      );

      const result = await service.update(
        '67d0f4a5f99f719467f91a07',
        {
          deviceBrand: 'Marca no autorizada',
          status: ServiceOrderStatus.IN_PROGRESS,
        },
        {
          role: UserRole.TECHNICIAN,
          userId: 'tech-user',
          technicianId,
        },
      );

      expect(result.status).toBe(ServiceOrderStatus.IN_PROGRESS);
      expect(result.deviceBrand).toBe(mockOrder.deviceBrand);
    });

    it('should reject a request containing only an intake change from a technician', async () => {
      const technicianId = '67d0f4a5f99f719467f91a03';
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        technicianId,
      });

      await expect(
        service.update(
          '67d0f4a5f99f719467f91a07',
          { deviceBrand: 'Marca no autorizada' },
          {
            role: UserRole.TECHNICIAN,
            userId: 'tech-user',
            technicianId,
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('public tracking', () => {
    beforeAll(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-30T12:00:00.000Z'));
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('returns only the public order fields for a signed token', async () => {
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        updatedAt: new Date('2026-07-30T12:00:00.000Z'),
      });

      const result = await service.findPublicTracking(
        createTrackingToken('67d0f4a5f99f719467f91a07', 'test-tracking-secret'),
      );

      expect(result).toEqual({
        orderNumber: mockOrder.orderNumber,
        device: {
          type: mockOrder.deviceType,
          brand: mockOrder.deviceBrand,
          model: mockOrder.deviceModel,
        },
        status: mockOrder.status,
        statusLabelEs: 'Pendiente',
        estimatedDelivery: mockOrder.estimatedDelivery,
        updatedAt: new Date('2026-07-30T12:00:00.000Z'),
      });
      expect(result).not.toHaveProperty('customerId');
      expect(result).not.toHaveProperty('problemDescription');
    });

    it('returns the expiration date for a recently delivered order', async () => {
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        status: ServiceOrderStatus.DELIVERED,
        deliveredAt: new Date('2026-07-15T12:00:00.000Z'),
        updatedAt: new Date('2026-07-15T12:00:00.000Z'),
      });

      const result = await service.findPublicTracking(
        createTrackingToken('67d0f4a5f99f719467f91a07', 'test-tracking-secret'),
      );

      expect(result).toEqual(
        expect.objectContaining({
          status: ServiceOrderStatus.DELIVERED,
          trackingExpiresAt: new Date('2026-08-14T12:00:00.000Z'),
        }),
      );
    });

    it('returns 410 when a cancelled order exceeds its retention period', async () => {
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        status: ServiceOrderStatus.CANCELLED,
        updatedAt: new Date('2026-06-01T12:00:00.000Z'),
      });

      await expect(
        service.findPublicTracking(
          createTrackingToken(
            '67d0f4a5f99f719467f91a07',
            'test-tracking-secret',
          ),
        ),
      ).rejects.toThrow(GoneException);
    });

    it('does not expire a completed order before delivery', async () => {
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        status: ServiceOrderStatus.COMPLETED,
        updatedAt: new Date('2025-01-01T12:00:00.000Z'),
      });

      const result = await service.findPublicTracking(
        createTrackingToken('67d0f4a5f99f719467f91a07', 'test-tracking-secret'),
      );

      expect(result.status).toBe(ServiceOrderStatus.COMPLETED);
      expect(result).not.toHaveProperty('trackingExpiresAt');
    });
  });
});
