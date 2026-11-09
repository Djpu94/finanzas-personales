import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';
import { UsersService } from '../../users/users.service.js';
import { JwtPayload } from '../token.service.js';
import { readCookie } from '../auth-cookies.js';
import { ACCESS_TOKEN_COOKIE } from '../../../core/constants.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: (req: Request) => readCookie(req, ACCESS_TOKEN_COOKIE),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<UserResponseDto> {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    return UserResponseDto.fromDocument(user);
  }
}
