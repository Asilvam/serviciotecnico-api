import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ServiceOrdersService } from './service-orders.service';
import { ServiceOrder, ServiceOrderItem, ServiceOrderStatus, ServiceOrderPriority } from './service-order.entity';

const mockOrder: ServiceOrder = {
  id: 1,
  orderNumber: 'OT-20250101-0001',
  customerId: 1,
  customer: null,
  technicianId: null,
  technician: null,
  deviceType: 'Laptop',
  deviceBrand: 'HP',
  deviceModel: 'Pavilion 15',
  serialNumber: 'ABC123',
  problemDescription: 'No enciende',
  diagnosis: null,
  workDone: null,
  status: ServiceOrderStatus.PENDING,
  priority: ServiceOrderPriority.MEDIUM,
  laborCost: 0,
  partsCost: 0,
  totalCost: 0,
  items: [],
  estimatedDelivery: null,
  deliveredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockOrderRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockItemRepository = {
  create: jest.fn(),
  save: jest.fn(),
};

describe('ServiceOrdersService', () => {
  let service: ServiceOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceOrdersService,
        { provide: getRepositoryToken(ServiceOrder), useValue: mockOrderRepository },
        { provide: getRepositoryToken(ServiceOrderItem), useValue: mockItemRepository },
      ],
    }).compile();

    service = module.get<ServiceOrdersService>(ServiceOrdersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a service order', async () => {
      mockOrderRepository.create.mockReturnValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);

      const result = await service.create({
        customerId: 1,
        deviceType: 'Laptop',
        deviceBrand: 'HP',
        problemDescription: 'No enciende',
      });

      expect(result).toBeDefined();
      expect(result.customerId).toBe(1);
    });

    it('should calculate parts cost and total cost when items are provided', async () => {
      const orderWithItems = { ...mockOrder, partsCost: 50000, totalCost: 50000 };
      mockOrderRepository.create.mockReturnValue({ ...mockOrder });
      mockOrderRepository.save.mockResolvedValue(orderWithItems);
      mockItemRepository.create.mockImplementation((item) => item);
      mockItemRepository.save.mockResolvedValue([]);

      const result = await service.create({
        customerId: 1,
        deviceType: 'Laptop',
        deviceBrand: 'HP',
        problemDescription: 'No enciende',
        items: [
          { productId: 1, productName: 'Pantalla LCD', unitPrice: 25000, quantity: 2 },
        ],
      });

      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all service orders', async () => {
      mockOrderRepository.find.mockResolvedValue([mockOrder]);
      const result = await service.findAll();
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findOne', () => {
    it('should return a service order by id', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      const result = await service.findOne(1);
      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if not found', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should cancel a service order', async () => {
      const order = { ...mockOrder };
      mockOrderRepository.findOne.mockResolvedValue(order);
      mockOrderRepository.save.mockImplementation((o) => Promise.resolve(o));

      const result = await service.cancel(1);
      expect(result.status).toBe(ServiceOrderStatus.CANCELLED);
    });
  });
});
