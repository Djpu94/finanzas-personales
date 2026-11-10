import { IsIn, IsOptional, Matches } from 'class-validator';
import {
  ANALYTICS_GRANULARITIES,
  DAY_KEY_PATTERN,
  MONTH_KEY_PATTERN,
  type AnalyticsGranularity,
} from '../analytics-periods.js';

export class AnalyticsOverviewQueryDto {
  @IsOptional()
  @Matches(MONTH_KEY_PATTERN, { message: 'month debe tener formato YYYY-MM' })
  month?: string;
}

export class AnalyticsSeriesQueryDto {
  @Matches(DAY_KEY_PATTERN, { message: 'from debe tener formato YYYY-MM-DD' })
  from: string;

  @Matches(DAY_KEY_PATTERN, { message: 'to debe tener formato YYYY-MM-DD' })
  to: string;

  @IsOptional()
  @IsIn(ANALYTICS_GRANULARITIES)
  granularity?: AnalyticsGranularity;
}
