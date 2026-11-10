import { ConflictException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '../categories/category.schema.js';
import type { Transaction } from '../transactions/transaction.schema.js';
import type { Budget } from './budget.schema.js';
import { BudgetsService } from './budgets.service.js';

const USER_ID = '665f1a2b3c4d5e6f7a8b9c0d';
const HOME_ID = new Types.ObjectId();
const LIGHT_ID = new Types.ObjectId();
const WATER_ID = new Types.ObjectId();
const LEISURE_ID = new Types.ObjectId();

function budgetDoc(
  overrides: Partial<{
    categoryId: Types.ObjectId;
    limitAmount: number;
    alertsEnabled: boolean;
  }> = {},
) {
  const categoryId = overrides.categoryId ?? HOME_ID;
  const _id = new Types.ObjectId();
  return {
    _id,
    id: _id.toString(),
    categoryId,
    period: '2024-03',
    limitAmount: overrides.limitAmount ?? 10000,
    alertsEnabled: overrides.alertsEnabled ?? true,
  };
}

describe('BudgetsService', () => {
  let budgetModel: Record<string, ReturnType<typeof vi.fn>>;
  let categoryModel: Record<string, ReturnType<typeof vi.fn>>;
  let transactionModel: Record<string, ReturnType<typeof vi.fn>>;
  let service: BudgetsService;
  let budgets: ReturnType<typeof budgetDoc>[];
  let totals: { categoryId: Types.ObjectId; total: number }[];

  function build(options: {
    budgets?: ReturnType<typeof budgetDoc>[];
    totals?: { categoryId: Types.ObjectId; total: number }[];
  }) {
    budgets = options.budgets ?? [];
    totals = options.totals ?? [];

    const query = (result: unknown) => {
      const chain = {
        sort: vi.fn(() => chain),
        exec: vi.fn().mockResolvedValue(result),
      };
      return chain;
    };

    budgetModel = {
      find: vi.fn(() => query(budgets)),
      create: vi.fn(),
      findOneAndUpdate: vi.fn(),
      deleteOne: vi.fn(),
    };
    categoryModel = {
      find: vi.fn(() => ({
        lean: () => ({
          exec: vi.fn().mockResolvedValue([
            { _id: HOME_ID, parentId: null },
            { _id: LIGHT_ID, parentId: HOME_ID },
            { _id: WATER_ID, parentId: HOME_ID },
            { _id: LEISURE_ID, parentId: null },
          ]),
        }),
      })),
      exists: vi.fn(() => ({
        exec: vi.fn().mockResolvedValue({ _id: HOME_ID }),
      })),
    };
    transactionModel = {
      aggregate: vi.fn(() => ({
        exec: vi.fn().mockResolvedValue(totals),
      })),
    };

    service = new BudgetsService(
      budgetModel as unknown as Model<Budget>,
      categoryModel as unknown as Model<Category>,
      transactionModel as unknown as Model<Transaction>,
    );
  }

  beforeEach(() => {
    build({});
  });

  describe('findByPeriod', () => {
    it('calcula spent con subcategorías y el porcentaje sobre el límite', async () => {
      build({
        budgets: [budgetDoc({ limitAmount: 10000 })],
        totals: [
          { categoryId: HOME_ID, total: 2000 },
          { categoryId: LIGHT_ID, total: 1500 },
          { categoryId: LEISURE_ID, total: 99999 },
        ],
      });

      const [progress] = await service.findByPeriod(USER_ID, '2024-03');

      expect(progress.spent).toBe(3500);
      expect(progress.percentage).toBe(35);
    });

    it('calcula spent sin subcategorías cuando la categoría no tiene hijas', async () => {
      build({
        budgets: [budgetDoc({ categoryId: LEISURE_ID, limitAmount: 4000 })],
        totals: [
          { categoryId: HOME_ID, total: 2000 },
          { categoryId: LEISURE_ID, total: 1000 },
        ],
      });

      const [progress] = await service.findByPeriod(USER_ID, '2024-03');

      expect(progress.spent).toBe(1000);
      expect(progress.percentage).toBe(25);
    });
  });

  describe('create', () => {
    it('responde 409 si ya existe un presupuesto para la misma categoría y periodo', async () => {
      build({});
      budgetModel.create = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));

      await expect(
        service.create(USER_ID, {
          categoryId: HOME_ID.toString(),
          period: '2024-03',
          limitAmount: 10000,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('getAlerts', () => {
    it('devuelve solo presupuestos con alertas activas al 80% o más', async () => {
      build({
        budgets: [
          budgetDoc({ limitAmount: 10000 }),
          budgetDoc({ categoryId: LEISURE_ID, limitAmount: 1000 }),
        ],
        totals: [
          { categoryId: HOME_ID, total: 8000 },
          { categoryId: LEISURE_ID, total: 1500 },
        ],
      });

      const alerts = await service.getAlerts(USER_ID, '2024-03');

      expect(alerts).toEqual([
        {
          budgetId: budgets[1].id,
          categoryId: LEISURE_ID.toString(),
          period: '2024-03',
          limitAmount: 1000,
          spent: 1500,
          percentage: 150,
          level: 'exceeded',
        },
        {
          budgetId: budgets[0].id,
          categoryId: HOME_ID.toString(),
          period: '2024-03',
          limitAmount: 10000,
          spent: 8000,
          percentage: 80,
          level: 'warning',
        },
      ]);
    });
  });
});
