import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsNullableMongoId } from '../../../common/decorators/is-nullable-mongo-id.decorator.js';
import {
  TRANSACTION_TYPES,
  type TransactionType,
} from '../transaction.schema.js';

const MAX_TAGS_PER_TRANSACTION = 20;

export class CreateTransactionDto {
  @IsIn(TRANSACTION_TYPES)
  type: TransactionType;

  // Importe en centavos.
  @IsInt()
  @Min(0)
  amount: number;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 500)
  description: string;

  @IsMongoId()
  accountId: string;

  // Ausente o null: sin cuenta de destino (solo transferencias).
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNullableMongoId()
  targetAccountId?: string | null;

  // Ausente o null: sin categoría.
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNullableMongoId()
  categoryId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS_PER_TRANSACTION)
  @IsMongoId({ each: true })
  tagIds?: string[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(0, 1000)
  notes?: string;
}
