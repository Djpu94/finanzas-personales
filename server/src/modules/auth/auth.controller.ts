import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../../common/types/request-user.interface.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { AuthLoginService } from './auth-login.service.js';
import { AuthLogoutService } from './auth-logout.service.js';
import { AuthRefreshService } from './auth-refresh.service.js';
import { AuthRegisterService } from './auth-register.service.js';
import { clearAuthCookies, setAuthCookies } from './auth-cookies.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard.js';
import { RefreshRequestUser } from './strategies/jwt-refresh.strategy.js';

type RefreshRequest = Request & { user: RefreshRequestUser };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authRegisterService: AuthRegisterService,
    private readonly authLoginService: AuthLoginService,
    private readonly authRefreshService: AuthRefreshService,
    private readonly authLogoutService: AuthLogoutService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    return this.authRegisterService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserResponseDto> {
    const { user, tokens } = await this.authLoginService.login(dto);
    setAuthCookies(res, tokens);
    return user;
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: RefreshRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const tokens = await this.authRefreshService.refresh(
      req.user.id,
      req.user.refreshToken,
    );
    setAuthCookies(res, tokens);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authLogoutService.logout(user.id);
    clearAuthCookies(res);
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser): UserResponseDto {
    return user;
  }
}
