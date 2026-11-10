import type { PipelineStage, Types } from 'mongoose';
import type { AnalyticsGranularity, DateRange } from './analytics-periods.js';

// Las transferencias no son ingreso ni gasto: quedan fuera de todos los pipelines.
const CASH_FLOW_TYPES = ['income', 'expense'];

const DATE_FORMAT_BY_GRANULARITY: Record<AnalyticsGranularity, string> = {
  day: '%Y-%m-%d',
  month: '%Y-%m',
};

const SIGNED_AMOUNT_EXPRESSION = {
  $cond: [
    { $eq: ['$type', 'income'] },
    '$amount',
    { $multiply: ['$amount', -1] },
  ],
};

function buildDateMatch(range: DateRange): Record<string, Date> {
  return { $gte: range.start, $lt: range.endExclusive };
}

// Ingresos y gastos agrupados por periodo (UTC) y tipo.
export function buildCashFlowPipeline(
  userId: Types.ObjectId,
  range: DateRange,
  granularity: AnalyticsGranularity,
): PipelineStage[] {
  return [
    {
      $match: {
        userId,
        type: { $in: CASH_FLOW_TYPES },
        date: buildDateMatch(range),
      },
    },
    {
      $group: {
        _id: {
          period: {
            $dateToString: {
              format: DATE_FORMAT_BY_GRANULARITY[granularity],
              date: '$date',
              timezone: 'UTC',
            },
          },
          type: '$type',
        },
        total: { $sum: '$amount' },
      },
    },
    {
      $project: {
        _id: 0,
        period: '$_id.period',
        type: '$_id.type',
        total: 1,
      },
    },
  ];
}

// Gasto por categoría. Sin `limit` devuelve todas las categorías.
export function buildTopExpenseCategoriesPipeline(
  userId: Types.ObjectId,
  range: DateRange,
  limit?: number,
): PipelineStage[] {
  const stages: PipelineStage[] = [
    {
      $match: {
        userId,
        type: 'expense',
        categoryId: { $ne: null },
        date: buildDateMatch(range),
      },
    },
    { $group: { _id: '$categoryId', total: { $sum: '$amount' } } },
    { $sort: { total: -1, _id: 1 } },
  ];
  if (limit !== undefined) {
    stages.push({ $limit: limit });
  }
  stages.push({ $project: { _id: 0, categoryId: '$_id', total: 1 } });
  return stages;
}

// Suma firmada (ingreso positivo, gasto negativo) de los movimientos del
// usuario. Con `before` solo considera los anteriores a esa fecha.
export function buildNetTotalPipeline(
  userId: Types.ObjectId,
  before?: Date,
): PipelineStage[] {
  const match: Record<string, unknown> = {
    userId,
    type: { $in: CASH_FLOW_TYPES },
  };
  if (before) {
    match.date = { $lt: before };
  }
  return [
    { $match: match },
    { $group: { _id: null, net: { $sum: SIGNED_AMOUNT_EXPRESSION } } },
  ];
}

export function buildInitialBalancePipeline(
  userId: Types.ObjectId,
): PipelineStage[] {
  return [
    { $match: { userId } },
    { $group: { _id: null, total: { $sum: '$initialBalance' } } },
  ];
}
