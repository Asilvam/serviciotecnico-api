import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product, ProductType } from './product.entity';

const mockProduct: Product = {
  id: '67d0f4a5f99f719467f91a04',
  name: 'Pantalla LCD 15"',
  description: 'Pantalla LCD para laptops',
  sku: 'LCD-15-001',
  price: 25000,
  type: ProductType.PART,
  stock: 10,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProductRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);
      mockProductRepository.create.mockReturnValue(mockProduct);
      mockProductRepository.save.mockResolvedValue(mockProduct);

      const result = await service.create({
        name: 'Pantalla LCD 15"',
        sku: 'LCD-15-001',
        price: 25000,
      });

      expect(result).toEqual(mockProduct);
    });

    it('should throw ConflictException if SKU already exists', async () => {
      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      await expect(
        service.create({ name: 'Product', sku: 'LCD-15-001', price: 100 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create services without stock', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);
      mockProductRepository.create.mockImplementation(
        (value: Product) => value,
      );
      mockProductRepository.save.mockImplementation((value: Product) =>
        Promise.resolve(value),
      );

      const result = await service.create({
        name: 'Diagnostico tecnico',
        sku: 'SERV-DIAG',
        price: 15000,
        type: ProductType.SERVICE,
        stock: 25,
      });

      expect(result.type).toBe(ProductType.SERVICE);
      expect(result.stock).toBe(0);
    });
  });

  describe('findAll', () => {
    it('should return all active products', async () => {
      mockProductRepository.find.mockResolvedValue([mockProduct]);
      const result = await service.findAll();
      expect(result).toEqual([mockProduct]);
    });

    it('should treat legacy products without type as parts', async () => {
      const legacyProduct = { ...mockProduct, type: undefined } as Product;
      mockProductRepository.find.mockResolvedValue([legacyProduct]);

      const result = await service.findAll();

      expect(result[0].type).toBe(ProductType.PART);
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      const result = await service.findOne('67d0f4a5f99f719467f91a04');
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException if not found', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('67d0f4a5f99f719467f91aff')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should reset stock when a product becomes a service', async () => {
      mockProductRepository.findOne.mockResolvedValue({ ...mockProduct });
      mockProductRepository.save.mockImplementation((value: Product) =>
        Promise.resolve(value),
      );

      const result = await service.update('67d0f4a5f99f719467f91a04', {
        type: ProductType.SERVICE,
      });

      expect(result.type).toBe(ProductType.SERVICE);
      expect(result.stock).toBe(0);
    });
  });

  describe('updateStock', () => {
    it('should increase stock', async () => {
      mockProductRepository.findOne.mockResolvedValue({
        ...mockProduct,
        stock: 10,
      });
      mockProductRepository.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.updateStock('67d0f4a5f99f719467f91a04', 5);
      expect(result.stock).toBe(15);
    });

    it('should not decrease stock below 0', async () => {
      mockProductRepository.findOne.mockResolvedValue({
        ...mockProduct,
        stock: 2,
      });
      mockProductRepository.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.updateStock('67d0f4a5f99f719467f91a04', -10);
      expect(result.stock).toBe(0);
    });

    it('should reject stock changes for services', async () => {
      mockProductRepository.findOne.mockResolvedValue({
        ...mockProduct,
        type: ProductType.SERVICE,
        stock: 0,
      });

      await expect(
        service.updateStock('67d0f4a5f99f719467f91a04', 1),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
