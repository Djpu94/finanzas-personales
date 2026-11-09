import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { IsNullableMongoId } from '../../../common/decorators/is-nullable-mongo-id.decorator.js';
import { HEX_COLOR_PATTERN } from '../../../common/utils/hex-color.js';
import { CATEGORY_TYPES, type CategoryType } from '../category.schema.js';

export class CreateCategoryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  name: string;

  @IsIn(CATEGORY_TYPES)
  type: CategoryType;

  @IsString()
  @Matches(HEX_COLOR_PATTERN)
  color: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string;

  // Ausente o null: categoría raíz.
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNullableMongoId()
  parentId?: string | null;
}
