import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TechniciansService } from './technicians.service';
import { Technician, TechnicianSpecialty } from './technician.entity';

const mockTechnician: Technician = {
  id: '67d0f4a5f99f719467f91a05',
  name: 'Carlos Técnico',
  email: 'carlos@example.com',
  phone: '+56987654321',
  specialty: TechnicianSpecialty.COMPUTING,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTechnicianRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('TechniciansService', () => {
  let service: TechniciansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TechniciansService, { provide: getRepositoryToken(Technician), useValue: mockTechnicianRepository }],
    }).compile();

    service = module.get<TechniciansService>(TechniciansService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a technician', async () => {
      mockTechnicianRepository.findOne.mockResolvedValue(null);
      mockTechnicianRepository.create.mockReturnValue(mockTechnician);
      mockTechnicianRepository.save.mockResolvedValue(mockTechnician);

      const result = await service.create({
        name: 'Carlos Técnico',
        email: 'carlos@example.com',
      });

      expect(result).toEqual(mockTechnician);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockTechnicianRepository.findOne.mockResolvedValue(mockTechnician);

      await expect(service.create({ name: 'Carlos', email: 'carlos@example.com' })).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all active technicians', async () => {
      mockTechnicianRepository.find.mockResolvedValue([mockTechnician]);
      const result = await service.findAll();
      expect(result).toEqual([mockTechnician]);
    });
  });

  describe('findOne', () => {
    it('should return a technician by id', async () => {
      mockTechnicianRepository.findOne.mockResolvedValue(mockTechnician);
      const result = await service.findOne('67d0f4a5f99f719467f91a05');
      expect(result).toEqual(mockTechnician);
    });

    it('should throw NotFoundException if not found', async () => {
      mockTechnicianRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('67d0f4a5f99f719467f91aff')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a technician', async () => {
      const updated = { ...mockTechnician, name: 'Updated Name' };
      mockTechnicianRepository.findOne.mockResolvedValue(mockTechnician);
      mockTechnicianRepository.save.mockResolvedValue(updated);

      const result = await service.update('67d0f4a5f99f719467f91a05', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw ConflictException if updated email already exists', async () => {
      const otherTechnician = {
        ...mockTechnician,
        id: '67d0f4a5f99f719467f91a06',
        email: 'other@example.com',
      };
      mockTechnicianRepository.findOne.mockResolvedValueOnce(mockTechnician).mockResolvedValueOnce(otherTechnician);

      await expect(service.update('67d0f4a5f99f719467f91a05', { email: 'other@example.com' })).rejects.toThrow(ConflictException);
    });
  });
});
