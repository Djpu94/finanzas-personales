import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Cache } from 'cache-manager';
import { Model, Types } from 'mongoose';
import { Account } from '../accounts/account.schema.js';
import { BudgetsService } from '../budgets/budgets.service.js';
import { Category } from '../categories/category.schema.js';
import { Transaction } from '../transactions/transaction.schema.js';
import {
  buildSeriesRange,
  listBucketKeys,
  parseMonthKey,
  percentVariation,
  previousMonthKey,
  toMonthKey,
  type AnalyticsGranularity,
  type DateRange,
} from './analytics-periods.js';
import {
  buildCashFlowPipeline,
  buildInitialBalancePipeline,
  buildNetTotalPipeline,
  buildTopExpenseCategoriesPipeline,
} from './analytics-pipelines.js';
import type { AnalyticsSeriesQueryDto } from './dto/analytics-query.dto.js';
import type {
  AnalyticsOverviewResponseDto,
  AnalyticsSeriesResponseDto,
  CategoryTotalDto,
} from './dto/analytics-response.dto.js';

export const ANALYTICS_CACHE_TTL_MS = 60_000;

const TOP_EXPENSE_CATEGORIES_LIMIT = 5;
const UNKNOWN_CATEGORY_NAME = 'Categoría desconocida';

interface CashFlowRow {
  period: string;
  type: 'income' | 'expense';
  total: number;
}

interface CategoryRow {
  categoryId: Types.ObjectId;
  total: number;
}

interface NetRow {
  net: number;
}

interface BalanceRow {
  total: number;
}

interface CashFlowTotals {
  income: number;
  expense: number;
}

const EMPTY_TOTALS: CashFlowTotals = { income: 0, expense: 0 };

function indexCashFlow(rows: CashFlowRow[]): Map<string, CashFlowTotals> {
  const totalsByPeriod = new Map<string, CashFlowTotals>();
  for (const row of rows) {
    const totals = totalsByPeriod.get(row.period) ?? { ...EMPTY_TOTALS };
    totals[row.type] += row.total;
    totalsByPeriod.set(row.period, totals);
  }
  return totalsByPeriod;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    @InjectModel(Account.name)
    private readonly accountModel: Model<Account>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
    private readonly budgetsService: BudgetsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // Las alertas de presupuesto se consultan fuera de la caché: cambian al
  // crear presupuestos o movimientos y no deben quedar desfasadas 60 s.
  async getOverview(
    userId: string,
    month?: string,
  ): Promise<AnalyticsOverviewResponseDto> {
    const resolvedMonth = month ?? toMonthKey(new Date());
    const [overview, budgetAlerts] = await Promise.all([
      this.withCache(`analytics:overview:${userId}:${resolvedMonth}`, () =>
        this.computeOverview(userId, resolvedMonth),
      ),
      this.budgetsService.getAlerts(userId, resolvedMonth),
    ]);
    return { ...overview, budgetAlerts };
  }

  async getSeries(
    userId: string,
    query: AnalyticsSeriesQueryDto,
  ): Promise<AnalyticsSeriesResponseDto> {
    const granularity: AnalyticsGranularity = query.granularity ?? 'day';
    const range = buildSeriesRange(query.from, query.to, granularity);
    const cacheKey = `analytics:series:${userId}:${query.from}:${query.to}:${granularity}`;
    return this.withCache(cacheKey, () =>
      this.computeSeries(userId, range, granularity),
    );
  }

  private async computeOverview(
    userId: string,
    month: string,
  ): Promise<Omit<AnalyticsOverviewResponseDto, 'budgetAlerts'>> {
    const objectId = new Types.ObjectId(userId);
    const currentRange = parseMonthKey(month);
    const previousMonth = previousMonthKey(month);
    const previousRange = parseMonthKey(previousMonth);

    const [flowRows, categoryRows, netRows, balanceRows] = await Promise.all([
      this.transactionModel
        .aggregate<CashFlowRow>(
          buildCashFlowPipeline(
            objectId,
            {
              start: previousRange.start,
              endExclusive: currentRange.endExclusive,
            },
            'month',
          ),
        )
        .exec(),
      this.transactionModel
        .aggregate<CategoryRow>(
          buildTopExpenseCategoriesPipeline(
            objectId,
            currentRange,
            TOP_EXPENSE_CATEGORIES_LIMIT,
          ),
        )
        .exec(),
      this.transactionModel
        .aggregate<NetRow>(buildNetTotalPipeline(objectId))
        .exec(),
      this.accountModel
        .aggregate<BalanceRow>(buildInitialBalancePipeline(objectId))
        .exec(),
    ]);

    const flows = indexCashFlow(flowRows);
    const current = flows.get(month) ?? EMPTY_TOTALS;
    const previous = flows.get(previousMonth) ?? EMPTY_TOTALS;
    const monthlyBalance = current.income - current.expense;
    const previousBalance = previous.income - previous.expense;

    return {
      netWorth: (balanceRows[0]?.total ?? 0) + (netRows[0]?.net ?? 0),
      monthlyIncome: current.income,
      monthlyExpense: current.expense,
      monthlyBalance,
      variationVsPreviousMonth: percentVariation(
        monthlyBalance,
        previousBalance,
      ),
      topExpenseCategories: await this.resolveCategoryTotals(
        objectId,
        categoryRows,
      ),
    };
  }

  private async computeSeries(
    userId: string,
    range: DateRange,
    granularity: AnalyticsGranularity,
  ): Promise<AnalyticsSeriesResponseDto> {
    const objectId = new Types.ObjectId(userId);
    const bucketKeys = listBucketKeys(range, granularity);

    const [flowRows, categoryRows, baselineRows, balanceRows] =
      await Promise.all([
        this.transactionModel
          .aggregate<CashFlowRow>(
            buildCashFlowPipeline(objectId, range, granularity),
          )
          .exec(),
        this.transactionModel
          .aggregate<CategoryRow>(
            buildTopExpenseCategoriesPipeline(objectId, range),
          )
          .exec(),
        this.transactionModel
          .aggregate<NetRow>(buildNetTotalPipeline(objectId, range.start))
          .exec(),
        this.accountModel
          .aggregate<BalanceRow>(buildInitialBalancePipeline(objectId))
          .exec(),
      ]);

    const flows = indexCashFlow(flowRows);
    const cashFlow = bucketKeys.map((date) => {
      const totals = flows.get(date) ?? EMPTY_TOTALS;
      return { date, income: totals.income, expense: totals.expense };
    });

    // Saldo inicial de cuentas + movimientos previos al rango, luego acumulado.
    let netWorth = (balanceRows[0]?.total ?? 0) + (baselineRows[0]?.net ?? 0);
    const netWorthEvolution = cashFlow.map((point) => {
      netWorth += point.income - point.expense;
      return { date: point.date, netWorth };
    });

    return {
      cashFlow,
      categoryDistribution: await this.resolveCategoryTotals(
        objectId,
        categoryRows,
      ),
      netWorthEvolution,
    };
  }

  private async resolveCategoryTotals(
    userId: Types.ObjectId,
    rows: CategoryRow[],
  ): Promise<CategoryTotalDto[]> {
    if (rows.length === 0) {
      return [];
    }

    const categories = await this.categoryModel
      .find(
        { userId, _id: { $in: rows.map((row) => row.categoryId) } },
        { name: 1 },
      )
      .lean()
      .exec();
    const namesById = new Map(
      categories.map((category) => [category._id.toString(), category.name]),
    );

    return rows.map((row) => {
      const categoryId = row.categoryId.toString();
      return {
        categoryId,
        name: namesById.get(categoryId) ?? UNKNOWN_CATEGORY_NAME,
        total: row.total,
      };
    });
  }

  private async withCache<T>(
    key: string,
    compute: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await compute();
    await this.cache.set(key, value, ANALYTICS_CACHE_TTL_MS);
    return value;
  }
}
