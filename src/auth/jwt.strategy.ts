import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { toObjectId } from '../common/mongo-id.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'changeme'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    this.logger.debug(`JWT validation for sub=${payload.sub}`);

    const objectId = toObjectId(payload.sub);
    if (!objectId) {
      this.logger.warn(`JWT rejected: invalid subject ${payload.sub}`);
      throw new UnauthorizedException();
    }

    const user = await this.userRepository.findOne({
      where: { _id: objectId, isActive: true },
    });
    if (!user) {
      this.logger.warn(`JWT rejected: user not found or inactive for sub=${payload.sub}`);
      throw new UnauthorizedException();
    }

    this.logger.debug(`JWT accepted for userId=${user.id ?? payload.sub}`);
    return user;
  }
}
