import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { AuthService } from './auth.service';
import { User, UserRole } from './user.entity';
import * as bcrypt from 'bcryptjs';
import { Technician } from '../technicians/technician.entity';

const mockUser: User = {
  id: '67d0f4a5f99f719467f91a01',
  _id: new ObjectId('67d0f4a5f99f719467f91a01'),
  email: 'test@example.com',
  password: '$2a$10$abcdefghij',
  name: 'Test User',
  role: UserRole.RECEPTIONIST,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
};

const mockTechnicianRepository = {
  findOne: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        {
          provide: getRepositoryToken(Technician),
          useValue: mockTechnicianRepository,
        },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and return access token', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result.accessToken).toBe('mock.jwt.token');
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'wrong@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createUser', () => {
    it('should create and return user without password', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation((payload: User) => payload);
      mockUserRepository.save.mockImplementation((payload: User) => payload);

      const result = await service.createUser({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });

      expect(result).not.toHaveProperty('password');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          name: 'New User',
          role: UserRole.RECEPTIONIST,
          isActive: true,
        }),
      );
      const createMock = mockUserRepository.create;
      const firstCreateCall = createMock.mock.calls[0] as [User];
      expect(firstCreateCall[0].password).not.toBe('password123');
    });

    it('should require an active technician link for technician users', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createUser({
          email: 'tech@example.com',
          password: 'password123',
          name: 'Tech User',
          role: UserRole.TECHNICIAN,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should persist the technician link for technician users', async () => {
      const technicianId = '67d0f4a5f99f719467f91a03';
      mockUserRepository.findOne.mockResolvedValue(null);
      mockTechnicianRepository.findOne.mockResolvedValue({ isActive: true });
      mockUserRepository.create.mockImplementation((payload: User) => payload);
      mockUserRepository.save.mockImplementation((payload: User) => payload);

      const result = await service.createUser({
        email: 'tech@example.com',
        password: 'password123',
        name: 'Tech User',
        role: UserRole.TECHNICIAN,
        technicianId,
      });

      expect(result.technicianId).toBe(technicianId);
    });
  });

  describe('findUserById', () => {
    it('should throw NotFoundException for invalid object id', async () => {
      await expect(service.findUserById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
