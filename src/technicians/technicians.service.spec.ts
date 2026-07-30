import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { TechniciansService } from './technicians.service';
import { Technician, TechnicianSpecialty } from './technician.entity';
import { ServiceOrder } from '../service-orders/service-order.entity';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../auth/user.entity';

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
  delete: jest.fn(),
};

const mockServiceOrderRepository = {
  count: jest.fn(),
};

const mockAuditService = {
  record: jest.fn(),
};

const adminActor = {
  userId: 'admin-id',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
};

describe('TechniciansService', () => {
  let service: TechniciansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TechniciansService,
        {
          provide: getRepositoryToken(Technician),
          useValue: mockTechnicianRepository,
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

      await expect(
        service.create({ name: 'Carlos', email: 'carlos@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return only active technicians by default', async () => {
      const inactive = { ...mockTechnician, id: 'inactive', isActive: false };
      mockTechnicianRepository.find.mockResolvedValue([
        mockTechnician,
        inactive,
      ]);
      const result = await service.findAll();
      expect(result).toEqual([mockTechnician]);
    });

    it('should include inactive technicians for administrators', async () => {
      const inactive = { ...mockTechnician, id: 'inactive', isActive: false };
      mockTechnicianRepository.find.mockResolvedValue([
        mockTechnician,
        inactive,
      ]);

      const result = await service.findAll(true);

      expect(result).toEqual([mockTechnician, inactive]);
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
      await expect(service.findOne('67d0f4a5f99f719467f91aff')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a technician', async () => {
      const updated = { ...mockTechnician, name: 'Updated Name' };
      mockTechnicianRepository.findOne.mockResolvedValue(mockTechnician);
      mockTechnicianRepository.save.mockResolvedValue(updated);

      const result = await service.update('67d0f4a5f99f719467f91a05', {
        name: 'Updated Name',
      });
      expect(result.name).toBe('Updated Name');
    });

    it('should update the technician status', async () => {
      const current = { ...mockTechnician, isActive: true };
      const updated = { ...current, isActive: false };
      mockTechnicianRepository.findOne.mockResolvedValue(current);
      mockTechnicianRepository.save.mockResolvedValue(updated);

      const result = await service.update('67d0f4a5f99f719467f91a05', {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
      expect(mockTechnicianRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should throw ConflictException if updated email already exists', async () => {
      const otherTechnician = {
        ...mockTechnician,
        id: '67d0f4a5f99f719467f91a06',
        email: 'other@example.com',
      };
      mockTechnicianRepository.findOne
        .mockResolvedValueOnce(mockTechnician)
        .mockResolvedValueOnce(otherTechnician);

      await expect(
        service.update('67d0f4a5f99f719467f91a05', {
          email: 'other@example.com',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deletePermanent', () => {
    it('should permanently delete a technician without associated orders and audit it', async () => {
      mockTechnicianRepository.findOne.mockResolvedValue(mockTechnician);
      mockServiceOrderRepository.count.mockResolvedValue(0);
      mockTechnicianRepository.delete.mockResolvedValue({ affected: 1 });
      mockAuditService.record.mockResolvedValue(undefined);

      await service.deletePermanent('67d0f4a5f99f719467f91a05', adminActor);

      expect(mockTechnicianRepository.delete).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        'technician.deleted_permanently',
        'technician',
        '67d0f4a5f99f719467f91a05',
        adminActor,
        expect.objectContaining({ associatedOrders: 0 }),
      );
    });

    it('should reject permanent deletion when the technician has associated orders', async () => {
      mockTechnicianRepository.findOne.mockResolvedValue(mockTechnician);
      mockServiceOrderRepository.count.mockResolvedValue(2);

      await expect(
        service.deletePermanent('67d0f4a5f99f719467f91a05', adminActor),
      ).rejects.toThrow(ConflictException);

      expect(mockTechnicianRepository.delete).not.toHaveBeenCalled();
      expect(mockAuditService.record).not.toHaveBeenCalled();
    });

    it('should reject permanent deletion for non-admin actors', async () => {
      await expect(
        service.deletePermanent('67d0f4a5f99f719467f91a05', {
          ...adminActor,
          role: UserRole.RECEPTIONIST,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockTechnicianRepository.findOne).not.toHaveBeenCalled();
    });
  });
});
