import { ConflictException, Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../../core/constants.js';
import { isDuplicateKeyError } from '../../common/utils/is-duplicate-key-error.js';
import { UsersService } from '../users/users.service.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthRegisterService {
  constructor(private readonly usersService: UsersService) {}

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      const user = await this.usersService.create({
        email: dto.email,
        passwordHash,
        name: dto.name,
      });
      return UserResponseDto.fromDocument(user);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }
}
