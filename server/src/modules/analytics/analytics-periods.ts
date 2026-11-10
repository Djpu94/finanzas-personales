import { BadRequestException } from '@nestjs/common';

export const ANALYTICS_GRANULARITIES = ['day', 'month'] as const;

export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number];

export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DAY_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/;

const INVALID_DAY_MESSAGE =
  'La fecha debe ser un día válido con formato YYYY-MM-DD';
const INVALID_RANGE_MESSAGE =
  'La fecha "desde" no puede ser posterior a la fecha "hasta"';

// Rango semiabierto [start, endExclusive) en UTC.
export interface DateRange {
  start: Date;
  endExclusive: Date;
}

export function parseMonthKey(month: string): DateRange {
  const [year, monthIndex] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthIndex - 1, 1)),
    endExclusive: new Date(Date.UTC(year, monthIndex, 1)),
  };
}

export function parseDayKey(day: string): Date {
  if (!DAY_KEY_PATTERN.test(day)) {
    throw new BadRequestException(INVALID_DAY_MESSAGE);
  }
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || toDayKey(date) !== day) {
    throw new BadRequestException(INVALID_DAY_MESSAGE);
  }
  return date;
}

export function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function toBucketKey(
  date: Date,
  granularity: AnalyticsGranularity,
): string {
  return granularity === 'month' ? toMonthKey(date) : toDayKey(date);
}

export function previousMonthKey(month: string): string {
  const { start } = parseMonthKey(month);
  start.setUTCMonth(start.getUTCMonth() - 1, 1);
  return toMonthKey(start);
}

// Para granularidad mensual el rango se alinea a meses completos, así
// los buckets y los movimientos agregados coinciden.
export function buildSeriesRange(
  from: string,
  to: string,
  granularity: AnalyticsGranularity,
): DateRange {
  const fromDate = parseDayKey(from);
  const toDate = parseDayKey(to);
  if (fromDate.getTime() > toDate.getTime()) {
    throw new BadRequestException(INVALID_RANGE_MESSAGE);
  }

  const endExclusive = new Date(toDate);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  if (granularity === 'month') {
    const start = new Date(
      Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1),
    );
    const alignedEnd = new Date(
      Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth() + 1, 1),
    );
    return { start, endExclusive: alignedEnd };
  }

  return { start: fromDate, endExclusive };
}

export function listBucketKeys(
  range: DateRange,
  granularity: AnalyticsGranularity,
): string[] {
  const keys: string[] = [];
  const cursor = new Date(range.start);

  while (cursor.getTime() < range.endExclusive.getTime()) {
    keys.push(toBucketKey(cursor, granularity));
    if (granularity === 'month') {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return keys;
}

// Variación porcentual redondeada a 2 decimales. Si el mes anterior es 0 no
// hay base de comparación y se devuelve 0.
export function percentVariation(current: number, previous: number): number {
  if (previous === 0) {
    return 0;
  }
  const variation = ((current - previous) / Math.abs(previous)) * 100;
  return Math.round(variation * 100) / 100;
}
