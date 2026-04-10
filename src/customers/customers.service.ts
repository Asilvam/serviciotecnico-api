import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { toObjectId } from '../common/mongo-id.util';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const existing = await this.customerRepository.findOne({
      where: { email: createCustomerDto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const customer = this.customerRepository.create(createCustomerDto);
    return this.customerRepository.save(customer);
  }

  async findAll(): Promise<Customer[]> {
    return this.customerRepository.find({ where: { isActive: true } });
  }

  async findOne(id: string): Promise<Customer> {
    const objectId = toObjectId(id);
    if (!objectId) {
      throw new NotFoundException(`Customer #${id} not found`);
    }

    const customer = await this.customerRepository.findOne({ where: { _id: objectId } });
    if (!customer) {
      throw new NotFoundException(`Customer #${id} not found`);
    }
    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);
    if (updateCustomerDto.email && updateCustomerDto.email !== customer.email) {
      const existing = await this.customerRepository.findOne({
        where: { email: updateCustomerDto.email },
      });
      if (existing) {
        throw new ConflictException('Email already registered');
      }
    }
    Object.assign(customer, updateCustomerDto);
    return this.customerRepository.save(customer);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    customer.isActive = false;
    await this.customerRepository.save(customer);
  }
}
