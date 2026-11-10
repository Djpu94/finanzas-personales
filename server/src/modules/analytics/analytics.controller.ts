import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../../common/types/request-user.interface.js';
import {
  AnalyticsOverviewQueryDto,
  AnalyticsSeriesQueryDto,
} from './dto/analytics-query.dto.js';
import type {
  AnalyticsOverviewResponseDto,
  AnalyticsSeriesResponseDto,
} from './dto/analytics-response.dto.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(
    @CurrentUser() user: RequestUser,
    @Query() query: AnalyticsOverviewQueryDto,
  ): Promise<AnalyticsOverviewResponseDto> {
    return this.analyticsService.getOverview(user.id, query.month);
  }

  @Get('series')
  getSeries(
    @CurrentUser() user: RequestUser,
    @Query() query: AnalyticsSeriesQueryDto,
  ): Promise<AnalyticsSeriesResponseDto> {
    return this.analyticsService.getSeries(user.id, query);
  }
}
