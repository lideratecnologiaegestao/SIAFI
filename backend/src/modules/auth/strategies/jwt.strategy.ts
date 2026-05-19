import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'siafi_jwt_secret_change_in_production',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.username) {
      throw new UnauthorizedException('Token inválido');
    }
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  }
}
