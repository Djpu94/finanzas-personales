import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { REFRESH_TOKEN_COOKIE } from '../../../core/constants.js';
import { readCookie } from '../auth-cookies.js';
import { JwtPayload } from '../token.service.js';

export interface RefreshRequestUser {
  id: string;
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => readCookie(req, REFRESH_TOKEN_COOKIE),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): RefreshRequestUser {
    const refreshToken = readCookie(req, REFRESH_TOKEN_COOKIE);

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    return { id: payload.sub, refreshToken };
  }
}
