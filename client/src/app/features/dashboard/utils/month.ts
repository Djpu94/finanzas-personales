import {
  fromLocalDateString,
  toLocalDateString,
} from '../../transactions/utils/transaction-query';

// Formato yyyy-MM, el mismo que acepta /api/analytics/overview.
export type MonthKey = string;

export interface MonthDateRange {
  from: string;
  to: string;
}

export function toMonthKey(date: Date): MonthKey {
  return toLocalDateString(date).slice(0, 7);
}

export function currentMonthKey(): MonthKey {
  return toMonthKey(new Date());
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [year, monthIndex] = month.split('-').map(Number);
  return toMonthKey(new Date(year, monthIndex - 1 + delta, 1));
}

export function monthDateRange(month: MonthKey): MonthDateRange {
  const [year, monthIndex] = month.split('-').map(Number);
  const first = new Date(year, monthIndex - 1, 1);
  const last = new Date(year, monthIndex, 0);
  return {
    from: toLocalDateString(first),
    to: toLocalDateString(last),
  };
}

export function formatMonthLabel(month: MonthKey, locale: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const label = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthIndex - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDayLabel(dateKey: string, locale: string): string {
  const date = fromLocalDateString(dateKey);
  if (!date) {
    return dateKey;
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(date);
}
