import { Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AuthTokens, TokenService } from './token.service.js';

export interface LoginResult {
  user: UserResponseDto;
  tokens: AuthTokens;
}

@Injectable()
export class AuthLoginService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.usersService.findByEmail(dto.email);
    const isPasswordValid =
      user !== null && (await bcrypt.compare(dto.password, user.passwordHash));

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = this.tokenService.issueTokens(user);
    await this.usersService.setRefreshTokenHash(
      user.id,
      this.tokenService.hashToken(tokens.refreshToken),
    );

    return { user: UserResponseDto.fromDocument(user), tokens };
  }
}
