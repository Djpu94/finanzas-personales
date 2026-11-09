import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { UsersService } from '../users/users.service.js';
import { AuthLoginService } from './auth-login.service.js';
import { TokenService } from './token.service.js';

type UsersServiceMock = {
  findByEmail: Mock;
  setRefreshTokenHash: Mock;
};

type TokenServiceMock = {
  issueTokens: Mock;
  hashToken: Mock;
};

describe('AuthLoginService', () => {
  let usersService: UsersServiceMock;
  let tokenService: TokenServiceMock;
  let service: AuthLoginService;

  const passwordHash = bcrypt.hashSync('correct-password', 4);
  const userDocument = {
    id: 'user-1',
    email: 'ana@example.com',
    name: 'Ana',
    passwordHash,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    usersService = {
      findByEmail: vi.fn(),
      setRefreshTokenHash: vi.fn().mockResolvedValue(undefined),
    };
    tokenService = {
      issueTokens: vi.fn().mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
      hashToken: vi.fn().mockReturnValue('refresh-hash'),
    };
    service = new AuthLoginService(
      usersService as unknown as UsersService,
      tokenService as unknown as TokenService,
    );
  });

  it('rechaza credenciales inválidas cuando el usuario no existe', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nadie@example.com', password: 'whatever' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(tokenService.issueTokens).not.toHaveBeenCalled();
    expect(usersService.setRefreshTokenHash).not.toHaveBeenCalled();
  });

  it('rechaza credenciales inválidas cuando la contraseña no coincide', async () => {
    usersService.findByEmail.mockResolvedValue(userDocument);

    await expect(
      service.login({ email: 'ana@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(tokenService.issueTokens).not.toHaveBeenCalled();
    expect(usersService.setRefreshTokenHash).not.toHaveBeenCalled();
  });

  it('emite tokens, guarda el hash del refresh y no expone el passwordHash', async () => {
    usersService.findByEmail.mockResolvedValue(userDocument);

    const result = await service.login({
      email: 'ana@example.com',
      password: 'correct-password',
    });

    expect(usersService.findByEmail).toHaveBeenCalledWith('ana@example.com');
    expect(tokenService.issueTokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', email: 'ana@example.com' }),
    );
    expect(tokenService.hashToken).toHaveBeenCalledWith('refresh-token');
    expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith(
      'user-1',
      'refresh-hash',
    );
    expect(result.tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(result.user).toEqual(
      expect.objectContaining({ id: 'user-1', email: 'ana@example.com', name: 'Ana' }),
    );
    expect(result.user).not.toHaveProperty('passwordHash');
  });
});
