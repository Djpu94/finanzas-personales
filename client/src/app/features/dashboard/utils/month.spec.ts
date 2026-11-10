import { describe, expect, it } from 'vitest';
import {
  formatDayLabel,
  formatMonthLabel,
  monthDateRange,
  shiftMonth,
} from './month';
import { formatCurrencyCents, formatCurrencyUnits } from './format';

describe('month helpers', () => {
  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2026-03', 0)).toBe('2026-03');
  });

  it('returns the first and last day of a month, including leap years', () => {
    expect(monthDateRange('2024-02')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
    expect(monthDateRange('2026-04')).toEqual({
      from: '2026-04-01',
      to: '2026-04-30',
    });
  });

  it('formats the month label capitalized for the locale', () => {
    expect(formatMonthLabel('2026-03', 'es-ES')).toBe('Marzo de 2026');
  });

  it('formats a day label and falls back to the raw key when invalid', () => {
    expect(formatDayLabel('2026-03-05', 'es-ES')).toBe('5 mar');
    expect(formatDayLabel('no-date', 'es-ES')).toBe('no-date');
  });
});

describe('currency formatting', () => {
  it('formats cents as currency units', () => {
    const formatted = formatCurrencyCents(12345678, 'EUR', 'es-ES');
    expect(formatted).toContain('123.456,78');
    expect(formatted).toContain('€');
  });

  it('limits fraction digits when requested', () => {
    expect(formatCurrencyUnits(12345.4, 'EUR', 'es-ES', 0)).toContain('12.345');
  });
});
