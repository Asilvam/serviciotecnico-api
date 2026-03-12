import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './product.entity';

const mockProduct: Product = {
  id: 1,
  name: 'Pantalla LCD 15"',
  description: 'Pantalla LCD para laptops',
  sku: 'LCD-15-001',
  price: 25000,
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
        { provide: getRepositoryToken(Product), useValue: mockProductRepository },
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
  });

  describe('findAll', () => {
    it('should return all active products', async () => {
      mockProductRepository.find.mockResolvedValue([mockProduct]);
      const result = await service.findAll();
      expect(result).toEqual([mockProduct]);
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      const result = await service.findOne(1);
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException if not found', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStock', () => {
    it('should increase stock', async () => {
      mockProductRepository.findOne.mockResolvedValue({ ...mockProduct, stock: 10 });
      mockProductRepository.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.updateStock(1, 5);
      expect(result.stock).toBe(15);
    });

    it('should not decrease stock below 0', async () => {
      mockProductRepository.findOne.mockResolvedValue({ ...mockProduct, stock: 2 });
      mockProductRepository.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.updateStock(1, -10);
      expect(result.stock).toBe(0);
    });
  });
});
