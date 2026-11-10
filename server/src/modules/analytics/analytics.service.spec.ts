import type { Cache } from 'cache-manager';
import { Model, Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from '../accounts/account.schema.js';
import { BudgetsService } from '../budgets/budgets.service.js';
import { Category } from '../categories/category.schema.js';
import { Transaction } from '../transactions/transaction.schema.js';
import { AnalyticsService } from './analytics.service.js';

const USER_ID = '665f1a2b3c4d5e6f7a8b9c0d';

function aggregateMock(rows: unknown[]) {
  return vi.fn().mockReturnValueOnce({
    exec: vi.fn().mockResolvedValue(rows),
  });
}

function createCache(): Cache & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return value;
    }),
  } as unknown as Cache & { store: Map<string, unknown> };
}

describe('AnalyticsService', () => {
  let transactionAggregate: ReturnType<typeof vi.fn>;
  let accountAggregate: ReturnType<typeof vi.fn>;
  let categoryFind: ReturnType<typeof vi.fn>;
  let cache: ReturnType<typeof createCache>;
  let budgetGetAlerts: ReturnType<typeof vi.fn>;
  let service: AnalyticsService;

  function build(options: {
    flows?: unknown[];
    categories?: unknown[];
    net?: unknown[];
    balances?: unknown[];
    categoryDocs?: unknown[];
    alerts?: unknown[];
  }) {
    // Orden de llamadas en computeOverview y computeSeries: flujo, categorías, neto; luego saldos.
    transactionAggregate = vi.fn();
    transactionAggregate
      .mockReturnValueOnce({
        exec: vi.fn().mockResolvedValue(options.flows ?? []),
      })
      .mockReturnValueOnce({
        exec: vi.fn().mockResolvedValue(options.categories ?? []),
      })
      .mockReturnValueOnce({
        exec: vi.fn().mockResolvedValue(options.net ?? []),
      });
    accountAggregate = aggregateMock(options.balances ?? []);
    categoryFind = vi.fn(() => ({
      lean: () => ({
        exec: vi.fn().mockResolvedValue(options.categoryDocs ?? []),
      }),
    }));
    cache = createCache();
    budgetGetAlerts = vi.fn().mockResolvedValue(options.alerts ?? []);

    service = new AnalyticsService(
      { aggregate: transactionAggregate } as unknown as Model<Transaction>,
      { aggregate: accountAggregate } as unknown as Model<Account>,
      { find: categoryFind } as unknown as Model<Category>,
      { getAlerts: budgetGetAlerts } as unknown as BudgetsService,
      cache,
    );
  }

  beforeEach(() => {
    build({});
  });

  describe('getOverview', () => {
    it('calcula KPIs consistentes con los movimientos del mes', async () => {
      build({
        flows: [
          { period: '2024-02', type: 'income', total: 50000 },
          { period: '2024-02', type: 'expense', total: 20000 },
          { period: '2024-03', type: 'income', total: 80000 },
          { period: '2024-03', type: 'expense', total: 30000 },
        ],
        net: [{ net: 5000 }],
        balances: [{ total: 100000 }],
      });

      const overview = await service.getOverview(USER_ID, '2024-03');

      expect(overview.netWorth).toBe(105000);
      expect(overview.monthlyIncome).toBe(80000);
      expect(overview.monthlyExpense).toBe(30000);
      expect(overview.monthlyBalance).toBe(50000);
      expect(overview.variationVsPreviousMonth).toBe(66.67);
      expect(overview.budgetAlerts).toEqual([]);
    });

    it('resuelve nombres de categorías y usa un nombre por defecto si falta', async () => {
      const knownId = new Types.ObjectId();
      const unknownId = new Types.ObjectId();
      build({
        categories: [
          { categoryId: knownId, total: 9000 },
          { categoryId: unknownId, total: 4000 },
        ],
        categoryDocs: [{ _id: knownId, name: 'Comida' }],
      });

      const overview = await service.getOverview(USER_ID, '2024-03');

      expect(overview.topExpenseCategories).toEqual([
        { categoryId: knownId.toString(), name: 'Comida', total: 9000 },
        {
          categoryId: unknownId.toString(),
          name: 'Categoría desconocida',
          total: 4000,
        },
      ]);
    });

    it('devuelve ceros para un usuario sin transacciones', async () => {
      build({});

      const overview = await service.getOverview(USER_ID, '2024-03');

      expect(overview).toEqual({
        netWorth: 0,
        monthlyIncome: 0,
        monthlyExpense: 0,
        monthlyBalance: 0,
        variationVsPreviousMonth: 0,
        topExpenseCategories: [],
        budgetAlerts: [],
      });
    });

    it('incluye las alertas de presupuesto sin cachearlas', async () => {
      const alert = {
        budgetId: '665f1a2b3c4d5e6f7a8b9c0e',
        categoryId: '665f1a2b3c4d5e6f7a8b9c0f',
        period: '2024-03',
        limitAmount: 10000,
        spent: 9000,
        percentage: 90,
        level: 'warning',
      };
      build({ alerts: [alert] });

      const first = await service.getOverview(USER_ID, '2024-03');
      const second = await service.getOverview(USER_ID, '2024-03');

      expect(first.budgetAlerts).toEqual([alert]);
      expect(second.budgetAlerts).toEqual([alert]);
      expect(budgetGetAlerts).toHaveBeenCalledTimes(2);
      expect(budgetGetAlerts).toHaveBeenCalledWith(USER_ID, '2024-03');
    });

    it('reutiliza el resultado cacheado sin volver a agregar', async () => {
      build({ balances: [{ total: 1000 }] });

      await service.getOverview(USER_ID, '2024-03');
      const callsAfterFirst = transactionAggregate.mock.calls.length;
      await service.getOverview(USER_ID, '2024-03');

      expect(transactionAggregate.mock.calls.length).toBe(callsAfterFirst);
      expect(accountAggregate).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSeries', () => {
    it('rellena los días sin movimientos con cero y acumula el saldo', async () => {
      build({
        flows: [
          { period: '2024-03-02', type: 'income', total: 1000 },
          { period: '2024-03-02', type: 'expense', total: 300 },
        ],
        net: [{ net: 500 }],
        balances: [{ total: 10000 }],
      });

      const series = await service.getSeries(USER_ID, {
        from: '2024-03-01',
        to: '2024-03-03',
        granularity: 'day',
      });

      expect(series.cashFlow).toEqual([
        { date: '2024-03-01', income: 0, expense: 0 },
        { date: '2024-03-02', income: 1000, expense: 300 },
        { date: '2024-03-03', income: 0, expense: 0 },
      ]);
      expect(series.netWorthEvolution).toEqual([
        { date: '2024-03-01', netWorth: 10500 },
        { date: '2024-03-02', netWorth: 11200 },
        { date: '2024-03-03', netWorth: 11200 },
      ]);
    });

    it('devuelve meses vacíos en granularidad mensual', async () => {
      build({
        flows: [{ period: '2024-01', type: 'expense', total: 700 }],
      });

      const series = await service.getSeries(USER_ID, {
        from: '2024-01-15',
        to: '2024-03-02',
        granularity: 'month',
      });

      expect(series.cashFlow.map((point) => point.date)).toEqual([
        '2024-01',
        '2024-02',
        '2024-03',
      ]);
      expect(series.cashFlow[0]).toEqual({
        date: '2024-01',
        income: 0,
        expense: 700,
      });
      expect(series.cashFlow[2]).toEqual({
        date: '2024-03',
        income: 0,
        expense: 0,
      });
    });

    it('devuelve series en ceros para un usuario sin transacciones', async () => {
      build({});

      const series = await service.getSeries(USER_ID, {
        from: '2024-03-01',
        to: '2024-03-02',
      });

      expect(series.cashFlow).toEqual([
        { date: '2024-03-01', income: 0, expense: 0 },
        { date: '2024-03-02', income: 0, expense: 0 },
      ]);
      expect(series.netWorthEvolution.every((p) => p.netWorth === 0)).toBe(
        true,
      );
      expect(series.categoryDistribution).toEqual([]);
    });
  });
});
