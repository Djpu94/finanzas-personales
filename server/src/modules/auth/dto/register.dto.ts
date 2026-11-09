import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeEmail } from '../../../common/utils/normalize-email.js';

export class RegisterDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  // bcrypt ignora los bytes posteriores a 72, por eso se limita la longitud.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  name: string;
}
