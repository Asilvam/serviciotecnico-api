import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { toObjectId } from '../common/mongo-id.util';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const existing = await this.productRepository.findOne({
      where: { sku: createProductDto.sku },
    });
    if (existing) {
      throw new ConflictException(
        `Product with SKU ${createProductDto.sku} already exists`,
      );
    }
    const product = this.productRepository.create(createProductDto);
    return this.productRepository.save(product);
  }

  async findAll(): Promise<Product[]> {
    return this.productRepository.find({ where: { isActive: true } });
  }

  async findOne(id: string): Promise<Product> {
    const objectId = toObjectId(id);
    if (!objectId) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    const product = await this.productRepository.findOne({ where: { _id: objectId } });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    return this.productRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    product.isActive = false;
    await this.productRepository.save(product);
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const product = await this.findOne(id);
    product.stock += quantity;
    if (product.stock < 0) {
      product.stock = 0;
    }
    return this.productRepository.save(product);
  }
}
