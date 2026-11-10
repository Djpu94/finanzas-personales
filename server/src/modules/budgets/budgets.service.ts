import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../../common/utils/is-duplicate-key-error.js';
import { parseMonthKey, toMonthKey } from '../analytics/analytics-periods.js';
import { Category } from '../categories/category.schema.js';
import { Transaction } from '../transactions/transaction.schema.js';
import {
  collectCategoryScope,
  computePercentage,
  resolveAlertLevel,
  sumSpentForScope,
  type CategoryLink,
} from './budget-calculations.js';
import { Budget, BudgetDocument } from './budget.schema.js';
import {
  BudgetAlertDto,
  BudgetProgressDto,
} from './dto/budget-response.dto.js';
import { CreateBudgetDto } from './dto/create-budget.dto.js';
import { UpdateBudgetDto } from './dto/update-budget.dto.js';

const BUDGET_NOT_FOUND_MESSAGE = 'Presupuesto no encontrado';
const BUDGET_DUPLICATE_MESSAGE =
  'Ya existe un presupuesto para esta categoría en este periodo';
const CATEGORY_NOT_FOUND_MESSAGE = 'La categoría no existe';

interface CategoryParentRow {
  _id: Types.ObjectId;
  parentId: Types.ObjectId | null;
}

interface CategoryTotalRow {
  categoryId: Types.ObjectId;
  total: number;
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name) private readonly budgetModel: Model<Budget>,
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {}

  async findByPeriod(
    userId: string,
    period?: string,
  ): Promise<BudgetProgressDto[]> {
    const resolvedPeriod = period ?? toMonthKey(new Date());
    const budgets = await this.budgetModel
      .find({ userId, period: resolvedPeriod })
      .sort({ createdAt: 1 })
      .exec();
    return this.computeProgress(userId, resolvedPeriod, budgets);
  }

  // Solo presupuestos con alertas activas y al 80% o más del límite.
  async getAlerts(userId: string, period?: string): Promise<BudgetAlertDto[]> {
    const resolvedPeriod = period ?? toMonthKey(new Date());
    const budgets = await this.budgetModel
      .find({ userId, period: resolvedPeriod, alertsEnabled: true })
      .exec();
    const progress = await this.computeProgress(
      userId,
      resolvedPeriod,
      budgets,
    );

    return progress
      .flatMap((item): BudgetAlertDto[] => {
        const level = resolveAlertLevel(item.percentage);
        if (!level) {
          return [];
        }
        return [
          {
            budgetId: item.id,
            categoryId: item.categoryId,
            period: item.period,
            limitAmount: item.limitAmount,
            spent: item.spent,
            percentage: item.percentage,
            level,
          },
        ];
      })
      .sort((a, b) => b.percentage - a.percentage);
  }

  async create(
    userId: string,
    dto: CreateBudgetDto,
  ): Promise<BudgetProgressDto> {
    await this.assertCategoryOwned(userId, dto.categoryId);

    let budget: BudgetDocument;
    try {
      budget = await this.budgetModel.create({ ...dto, userId });
    } catch (error) {
      throw this.toWriteError(error);
    }
    return this.toSingleProgress(userId, budget);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateBudgetDto,
  ): Promise<BudgetProgressDto> {
    if (dto.categoryId !== undefined) {
      await this.assertCategoryOwned(userId, dto.categoryId);
    }

    let budget: BudgetDocument | null;
    try {
      budget = await this.budgetModel
        .findOneAndUpdate(
          { _id: id, userId },
          { $set: withoutUndefined(dto) },
          { returnDocument: 'after', runValidators: true },
        )
        .exec();
    } catch (error) {
      throw this.toWriteError(error);
    }

    if (!budget) {
      throw new NotFoundException(BUDGET_NOT_FOUND_MESSAGE);
    }
    return this.toSingleProgress(userId, budget);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.budgetModel.deleteOne({ _id: id, userId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(BUDGET_NOT_FOUND_MESSAGE);
    }
  }

  // `spent` suma solo gastos de la categoría y sus subcategorías en el periodo.
  private async computeProgress(
    userId: string,
    period: string,
    budgets: BudgetDocument[],
  ): Promise<BudgetProgressDto[]> {
    if (budgets.length === 0) {
      return [];
    }

    const categories = await this.categoryModel
      .find({ userId }, { parentId: 1 })
      .lean<CategoryParentRow[]>()
      .exec();
    const links: CategoryLink[] = categories.map((category) => ({
      id: category._id.toString(),
      parentId: category.parentId?.toString() ?? null,
    }));
    const scopes = budgets.map((budget) =>
      collectCategoryScope(budget.categoryId.toString(), links),
    );

    const scopeObjectIds = [...new Set(scopes.flat())].map(
      (id) => new Types.ObjectId(id),
    );
    const { start, endExclusive } = parseMonthKey(period);
    const rows = await this.transactionModel
      .aggregate<CategoryTotalRow>([
        {
          $match: {
            userId: new Types.ObjectId(userId),
            type: 'expense',
            categoryId: { $in: scopeObjectIds },
            date: { $gte: start, $lt: endExclusive },
          },
        },
        { $group: { _id: '$categoryId', total: { $sum: '$amount' } } },
        { $project: { _id: 0, categoryId: '$_id', total: 1 } },
      ])
      .exec();
    const totalsByCategoryId = new Map(
      rows.map((row) => [row.categoryId.toString(), row.total]),
    );

    return budgets.map((budget, index) => {
      const spent = sumSpentForScope(scopes[index], totalsByCategoryId);
      return {
        id: budget.id,
        categoryId: budget.categoryId.toString(),
        period: budget.period,
        limitAmount: budget.limitAmount,
        alertsEnabled: budget.alertsEnabled,
        spent,
        percentage: computePercentage(spent, budget.limitAmount),
      };
    });
  }

  private async toSingleProgress(
    userId: string,
    budget: BudgetDocument,
  ): Promise<BudgetProgressDto> {
    const [progress] = await this.computeProgress(userId, budget.period, [
      budget,
    ]);
    return progress;
  }

  private async assertCategoryOwned(
    userId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.categoryModel
      .exists({ _id: categoryId, userId })
      .exec();
    if (!category) {
      throw new BadRequestException(CATEGORY_NOT_FOUND_MESSAGE);
    }
  }

  private toWriteError(error: unknown): unknown {
    return isDuplicateKeyError(error)
      ? new ConflictException(BUDGET_DUPLICATE_MESSAGE)
      : error;
  }
}
