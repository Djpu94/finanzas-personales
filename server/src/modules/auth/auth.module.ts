import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthLoginService } from './auth-login.service.js';
import { AuthLogoutService } from './auth-logout.service.js';
import { AuthRefreshService } from './auth-refresh.service.js';
import { AuthRegisterService } from './auth-register.service.js';
import { TokenService } from './token.service.js';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [ConfigModule, JwtModule.register({}), UsersModule],
  controllers: [AuthController],
  providers: [
    AuthRegisterService,
    AuthLoginService,
    AuthRefreshService,
    AuthLogoutService,
    TokenService,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
})
export class AuthModule {}
