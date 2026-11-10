import { IsIn, IsOptional, Matches } from 'class-validator';
import { MONTH_KEY_PATTERN } from '../../analytics/analytics-periods.js';
import { REPORT_FORMATS, type ReportFormat } from '../report-rules.js';

export class MonthlyReportQueryDto {
  @Matches(MONTH_KEY_PATTERN, { message: 'period debe tener formato YYYY-MM' })
  period: string;

  @IsOptional()
  @IsIn(REPORT_FORMATS, { message: 'format debe ser csv o pdf' })
  format?: ReportFormat;
}
