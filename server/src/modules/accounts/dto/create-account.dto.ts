import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ACCOUNT_TYPES, type AccountType } from '../account.schema.js';

export class CreateAccountDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  name: string;

  @IsIn(ACCOUNT_TYPES)
  type: AccountType;

  // Importe en centavos.
  @IsInt()
  initialBalance: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}
