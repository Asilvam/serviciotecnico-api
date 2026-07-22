import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { Customer } from './customer.entity';
import { ServiceOrder } from '../service-orders/service-order.entity';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../auth/user.entity';

const mockCustomer: Customer = {
  id: '67d0f4a5f99f719467f91a02',
  name: 'Juan Pérez',
  email: 'juan@example.com',
  phone: '+56912345678',
  address: 'Av. Providencia 123',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCustomerRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

const mockServiceOrderRepository = {
  count: jest.fn(),
};

const mockAuditService = {
  record: jest.fn().mockResolvedValue(undefined),
};

const adminActor = {
  role: UserRole.ADMIN,
  userId: 'admin-id',
  email: 'admin@example.com',
};

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: getRepositoryToken(Customer),
          useValue: mockCustomerRepository,
        },
        {
          provide: getRepositoryToken(ServiceOrder),
          useValue: mockServiceOrderRepository,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new customer', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(null);
      mockCustomerRepository.create.mockReturnValue(mockCustomer);
      mockCustomerRepository.save.mockResolvedValue(mockCustomer);

      const result = await service.create({
        name: 'Juan Pérez',
        email: 'juan@example.com',
      });

      expect(result).toEqual(mockCustomer);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(mockCustomer);

      await expect(
        service.create({ name: 'Juan', email: 'juan@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all active customers', async () => {
      mockCustomerRepository.find.mockResolvedValue([
        mockCustomer,
        { ...mockCustomer, id: 'inactive-id', isActive: false },
      ]);
      const result = await service.findAll();
      expect(result).toEqual([mockCustomer]);
    });

    it('should include inactive customers when requested by administration', async () => {
      const inactiveCustomer = {
        ...mockCustomer,
        id: 'inactive-id',
        isActive: false,
      };
      mockCustomerRepository.find.mockResolvedValue([
        mockCustomer,
        inactiveCustomer,
      ]);

      const result = await service.findAll(true);

      expect(result).toEqual([mockCustomer, inactiveCustomer]);
    });
  });

  describe('findOne', () => {
    it('should return a customer by id', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(mockCustomer);
      const result = await service.findOne('67d0f4a5f99f719467f91a02');
      expect(result).toEqual(mockCustomer);
    });

    it('should throw NotFoundException if customer not found', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('67d0f4a5f99f719467f91aff')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a customer', async () => {
      const updated = { ...mockCustomer, name: 'Updated Name' };
      mockCustomerRepository.findOne.mockResolvedValue(mockCustomer);
      mockCustomerRepository.save.mockResolvedValue(updated);

      const result = await service.update('67d0f4a5f99f719467f91a02', {
        name: 'Updated Name',
      });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw ConflictException if updated email already exists', async () => {
      const otherCustomer = {
        ...mockCustomer,
        id: '67d0f4a5f99f719467f91a03',
        email: 'other@example.com',
      };
      mockCustomerRepository.findOne
        .mockResolvedValueOnce(mockCustomer)
        .mockResolvedValueOnce(otherCustomer);

      await expect(
        service.update('67d0f4a5f99f719467f91a02', {
          email: 'other@example.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should let administration reactivate a customer', async () => {
      const inactiveCustomer = { ...mockCustomer, isActive: false };
      mockCustomerRepository.findOne.mockResolvedValue(inactiveCustomer);
      mockCustomerRepository.save.mockImplementation((customer) =>
        Promise.resolve(customer),
      );

      const result = await service.update(
        '67d0f4a5f99f719467f91a02',
        { isActive: true },
        true,
      );

      expect(result.isActive).toBe(true);
    });

    it('should reject status changes without administration permission', async () => {
      mockCustomerRepository.findOne.mockResolvedValue({ ...mockCustomer });

      await expect(
        service.update('67d0f4a5f99f719467f91a02', { isActive: false }, false),
      ).rejects.toThrow('Solo administracion puede cambiar el estado');
    });
  });

  describe('remove', () => {
    it('should deactivate a customer', async () => {
      mockCustomerRepository.findOne.mockResolvedValue({ ...mockCustomer });
      mockCustomerRepository.save.mockResolvedValue({
        ...mockCustomer,
        isActive: false,
      });

      const result = await service.remove('67d0f4a5f99f719467f91a02');
      expect(mockCustomerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
      expect(result.isActive).toBe(false);
    });
  });

  describe('deletePermanent', () => {
    it('should permanently delete a customer without associated orders and audit it', async () => {
      mockCustomerRepository.findOne.mockResolvedValue({ ...mockCustomer });
      mockServiceOrderRepository.count.mockResolvedValue(0);
      mockCustomerRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deletePermanent('67d0f4a5f99f719467f91a02', adminActor);

      expect(mockCustomerRepository.delete).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        'customer.deleted_permanently',
        'customer',
        expect.any(String),
        adminActor,
        expect.objectContaining({
          name: mockCustomer.name,
          email: mockCustomer.email,
          associatedOrders: 0,
        }),
      );
    });

    it('should block permanent deletion when the customer has orders', async () => {
      mockCustomerRepository.findOne.mockResolvedValue({ ...mockCustomer });
      mockServiceOrderRepository.count.mockResolvedValue(2);

      await expect(
        service.deletePermanent('67d0f4a5f99f719467f91a02', adminActor),
      ).rejects.toThrow(ConflictException);

      expect(mockCustomerRepository.delete).not.toHaveBeenCalled();
      expect(mockAuditService.record).not.toHaveBeenCalled();
    });

    it('should reject permanent deletion without administration permission', async () => {
      await expect(
        service.deletePermanent('67d0f4a5f99f719467f91a02', {
          role: UserRole.RECEPTIONIST,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockCustomerRepository.delete).not.toHaveBeenCalled();
    });
  });
});
