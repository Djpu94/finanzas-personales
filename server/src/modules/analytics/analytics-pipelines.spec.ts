import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { buildSeriesRange } from './analytics-periods.js';
import {
  buildCashFlowPipeline,
  buildInitialBalancePipeline,
  buildNetTotalPipeline,
  buildTopExpenseCategoriesPipeline,
} from './analytics-pipelines.js';

describe('analytics-pipelines', () => {
  const userId = new Types.ObjectId('665f1a2b3c4d5e6f7a8b9c0d');
  const range = buildSeriesRange('2024-03-01', '2024-03-31', 'day');

  function matchOf(pipeline: unknown[]): Record<string, unknown> {
    const [first] = pipeline as Array<Record<string, Record<string, unknown>>>;
    return first.$match;
  }

  it.each([
    ['flujo de caja', buildCashFlowPipeline(userId, range, 'day')],
    ['categorías', buildTopExpenseCategoriesPipeline(userId, range)],
    ['saldo neto', buildNetTotalPipeline(userId)],
    ['saldo inicial', buildInitialBalancePipeline(userId)],
  ])('%s filtra por userId como primera etapa', (_name, pipeline) => {
    expect(matchOf(pipeline).userId).toBe(userId);
  });

  it('el flujo de caja excluye las transferencias', () => {
    const pipeline = buildCashFlowPipeline(userId, range, 'month');

    expect(matchOf(pipeline).type).toEqual({ $in: ['income', 'expense'] });
  });

  it('el neto excluye las transferencias', () => {
    expect(matchOf(buildNetTotalPipeline(userId)).type).toEqual({
      $in: ['income', 'expense'],
    });
  });

  it('el neto con fecha límite solo considera movimientos anteriores', () => {
    const before = new Date('2024-03-01T00:00:00.000Z');
    const match = matchOf(buildNetTotalPipeline(userId, before));

    expect(match.date).toEqual({ $lt: before });
  });

  it('las categorías aplican el límite solo cuando se indica', () => {
    const limited = buildTopExpenseCategoriesPipeline(userId, range, 5);
    const unlimited = buildTopExpenseCategoriesPipeline(userId, range);

    expect(limited).toContainEqual({ $limit: 5 });
    expect(unlimited.some((stage) => '$limit' in stage)).toBe(false);
  });

  it('el flujo de caja agrupa por periodo en UTC', () => {
    const pipeline = buildCashFlowPipeline(userId, range, 'month');
    const [, group] = pipeline as unknown as Array<Record<string, unknown>>;
    const groupId = (group.$group as { _id: { period: unknown } })._id.period;

    expect(groupId).toEqual({
      $dateToString: { format: '%Y-%m', date: '$date', timezone: 'UTC' },
    });
  });
});
