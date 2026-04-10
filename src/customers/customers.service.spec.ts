import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { Customer } from './customer.entity';

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
};

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomersService, { provide: getRepositoryToken(Customer), useValue: mockCustomerRepository }],
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

      await expect(service.create({ name: 'Juan', email: 'juan@example.com' })).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all active customers', async () => {
      mockCustomerRepository.find.mockResolvedValue([mockCustomer]);
      const result = await service.findAll();
      expect(result).toEqual([mockCustomer]);
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
      await expect(service.findOne('67d0f4a5f99f719467f91aff')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a customer', async () => {
      const updated = { ...mockCustomer, name: 'Updated Name' };
      mockCustomerRepository.findOne.mockResolvedValue(mockCustomer);
      mockCustomerRepository.save.mockResolvedValue(updated);

      const result = await service.update('67d0f4a5f99f719467f91a02', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw ConflictException if updated email already exists', async () => {
      const otherCustomer = {
        ...mockCustomer,
        id: '67d0f4a5f99f719467f91a03',
        email: 'other@example.com',
      };
      mockCustomerRepository.findOne.mockResolvedValueOnce(mockCustomer).mockResolvedValueOnce(otherCustomer);

      await expect(service.update('67d0f4a5f99f719467f91a02', { email: 'other@example.com' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should deactivate a customer', async () => {
      mockCustomerRepository.findOne.mockResolvedValue({ ...mockCustomer });
      mockCustomerRepository.save.mockResolvedValue({ ...mockCustomer, isActive: false });

      await service.remove('67d0f4a5f99f719467f91a02');
      expect(mockCustomerRepository.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });
  });
});
