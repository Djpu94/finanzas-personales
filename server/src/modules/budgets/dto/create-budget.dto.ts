import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';
import { MONTH_KEY_PATTERN } from '../../analytics/analytics-periods.js';

export class CreateBudgetDto {
  @IsMongoId()
  categoryId: string;

  @Matches(MONTH_KEY_PATTERN, { message: 'period debe tener formato YYYY-MM' })
  period: string;

  // Límite en centavos.
  @IsInt()
  @Min(1)
  limitAmount: number;

  @IsOptional()
  @IsBoolean()
  alertsEnabled?: boolean;
}
