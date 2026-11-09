import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { AuthTokens, TokenService } from './token.service.js';

@Injectable()
export class AuthRefreshService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
  ) {}

  async refresh(userId: string, presentedRefreshToken: string): Promise<AuthTokens> {
    const user = await this.usersService.findByIdWithRefreshTokenHash(userId);

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Sesión inválida');
    }

    // Un refresh token distinto al almacenado ya fue rotado: se asume reutilización y se revocan todas las sesiones.
    if (user.refreshTokenHash !== this.tokenService.hashToken(presentedRefreshToken)) {
      await this.usersService.setRefreshTokenHash(userId, null);
      throw new UnauthorizedException('Sesión inválida');
    }

    const tokens = this.tokenService.issueTokens(user);
    await this.usersService.setRefreshTokenHash(
      userId,
      this.tokenService.hashToken(tokens.refreshToken),
    );

    return tokens;
  }
}
