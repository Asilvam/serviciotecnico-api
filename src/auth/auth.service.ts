import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { toObjectId } from '../common/mongo-id.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) {
      return 'invalid-email';
    }
    if (local.length <= 2) {
      return `${local[0] ?? '*'}***@${domain}`;
    }
    return `${local.slice(0, 2)}***@${domain}`;
  }

  async register(registerDto: RegisterDto): Promise<{ accessToken: string }> {
    const maskedEmail = this.maskEmail(registerDto.email);
    this.logger.log(`Register attempt for ${maskedEmail}`);

    const existing = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });
    if (existing) {
      this.logger.warn(`Register rejected, email already exists: ${maskedEmail}`);
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
      // Avoid null from payload overriding entity defaults.
      role: registerDto.role ?? UserRole.RECEPTIONIST,
      isActive: true,
    });
    await this.userRepository.save(user);
    this.logger.log(`Register success for ${maskedEmail} (userId=${user.id ?? 'n/a'})`);

    return this.generateToken(user);
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string }> {
    const maskedEmail = this.maskEmail(loginDto.email);
    this.logger.log(`Login attempt for ${maskedEmail}`);

    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user || !user.isActive) {
      this.logger.warn(`Login rejected for ${maskedEmail}: user not found or inactive`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Login rejected for ${maskedEmail}: invalid password`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`Login success for ${maskedEmail} (userId=${user.id ?? 'n/a'})`);

    return this.generateToken(user);
  }

  async getProfile(userId: string): Promise<Omit<User, 'password'>> {
    this.logger.log(`Profile request for userId=${userId}`);

    const objectId = toObjectId(userId);
    if (!objectId) {
      this.logger.warn(`Profile rejected: invalid userId=${userId}`);
      throw new UnauthorizedException();
    }

    const user = await this.userRepository.findOne({
      where: { _id: objectId },
    });
    if (!user) {
      this.logger.warn(`Profile rejected: user not found for userId=${userId}`);
      throw new UnauthorizedException();
    }
    this.logger.log(`Profile success for userId=${user.id ?? userId}`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result as Omit<User, 'password'>;
  }

  private generateToken(user: User): { accessToken: string } {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
