import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import type { RequestUser } from '../../common/types/request-user.interface.js';
import { BudgetsService } from './budgets.service.js';
import { BudgetQueryDto } from './dto/budget-query.dto.js';
import type {
  BudgetAlertDto,
  BudgetProgressDto,
} from './dto/budget-response.dto.js';
import { CreateBudgetDto } from './dto/create-budget.dto.js';
import { UpdateBudgetDto } from './dto/update-budget.dto.js';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: BudgetQueryDto,
  ): Promise<BudgetProgressDto[]> {
    return this.budgetsService.findByPeriod(user.id, query.period);
  }

  @Get('alerts')
  getAlerts(
    @CurrentUser() user: RequestUser,
    @Query() query: BudgetQueryDto,
  ): Promise<BudgetAlertDto[]> {
    return this.budgetsService.getAlerts(user.id, query.period);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateBudgetDto,
  ): Promise<BudgetProgressDto> {
    return this.budgetsService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<BudgetProgressDto> {
    return this.budgetsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<void> {
    return this.budgetsService.remove(user.id, id);
  }
}
