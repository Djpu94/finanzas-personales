import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../../common/types/request-user.interface.js';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto.js';
import { ReportsService } from './reports.service.js';
import { reportFileName } from './report-rules.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  async getMonthlyReport(
    @CurrentUser() user: RequestUser,
    @Query() query: MonthlyReportQueryDto,
  ): Promise<StreamableFile> {
    const format = query.format ?? 'csv';
    const disposition = `attachment; filename="${reportFileName(query.period, format)}"`;

    if (format === 'pdf') {
      const pdf = await this.reportsService.buildMonthlyPdf(user.id, query.period);
      return new StreamableFile(pdf, {
        type: 'application/pdf',
        disposition,
        length: pdf.length,
      });
    }

    return new StreamableFile(
      this.reportsService.streamMonthlyCsv(user.id, query.period),
      { type: 'text/csv; charset=utf-8', disposition },
    );
  }
}
