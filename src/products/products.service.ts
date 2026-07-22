import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductType } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { toObjectId } from '../common/mongo-id.util';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  private normalizeLegacyProduct(product: Product): Product {
    product.type ??= ProductType.PART;
    return product;
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const existing = await this.productRepository.findOne({
      where: { sku: createProductDto.sku },
    });
    if (existing) {
      throw new ConflictException(
        `Product with SKU ${createProductDto.sku} already exists`,
      );
    }
    const type = createProductDto.type ?? ProductType.PART;
    const product = this.productRepository.create({
      ...createProductDto,
      type,
      stock: type === ProductType.SERVICE ? 0 : (createProductDto.stock ?? 0),
    });
    return this.productRepository.save(product);
  }

  async findAll(): Promise<Product[]> {
    const products = await this.productRepository.find({
      where: { isActive: true },
    });
    return products.map((product) => this.normalizeLegacyProduct(product));
  }

  async findOne(id: string): Promise<Product> {
    const objectId = toObjectId(id);
    if (!objectId) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    const product = await this.productRepository.findOne({
      where: { _id: objectId },
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return this.normalizeLegacyProduct(product);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    product.type ??= ProductType.PART;
    if (product.type === ProductType.SERVICE) {
      product.stock = 0;
    }
    return this.productRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    product.isActive = false;
    await this.productRepository.save(product);
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const product = await this.findOne(id);
    if (product.type === ProductType.SERVICE) {
      throw new BadRequestException(
        'Los servicios no administran existencias de inventario.',
      );
    }
    product.stock += quantity;
    if (product.stock < 0) {
      product.stock = 0;
    }
    return this.productRepository.save(product);
  }
}
