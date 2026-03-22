import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub || !payload.type) {
      throw new UnauthorizedException('Token inválido');
    }
    if (payload.type !== 'admin' && payload.type !== 'aspirante') {
      throw new UnauthorizedException('Token inválido');
    }
    return payload;
  }
}
