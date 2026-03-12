import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Technician } from './technician.entity';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';

@Injectable()
export class TechniciansService {
  constructor(
    @InjectRepository(Technician)
    private technicianRepository: Repository<Technician>,
  ) {}

  async create(createTechnicianDto: CreateTechnicianDto): Promise<Technician> {
    const existing = await this.technicianRepository.findOne({
      where: { email: createTechnicianDto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const technician = this.technicianRepository.create(createTechnicianDto);
    return this.technicianRepository.save(technician);
  }

  async findAll(): Promise<Technician[]> {
    return this.technicianRepository.find({ where: { isActive: true } });
  }

  async findOne(id: number): Promise<Technician> {
    const technician = await this.technicianRepository.findOne({ where: { id } });
    if (!technician) {
      throw new NotFoundException(`Technician #${id} not found`);
    }
    return technician;
  }

  async update(id: number, updateTechnicianDto: UpdateTechnicianDto): Promise<Technician> {
    const technician = await this.findOne(id);
    if (updateTechnicianDto.email && updateTechnicianDto.email !== technician.email) {
      const existing = await this.technicianRepository.findOne({
        where: { email: updateTechnicianDto.email },
      });
      if (existing) {
        throw new ConflictException('Email already registered');
      }
    }
    Object.assign(technician, updateTechnicianDto);
    return this.technicianRepository.save(technician);
  }

  async remove(id: number): Promise<void> {
    const technician = await this.findOne(id);
    technician.isActive = false;
    await this.technicianRepository.save(technician);
  }
}
