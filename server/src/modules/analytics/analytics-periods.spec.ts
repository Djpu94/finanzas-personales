import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  buildSeriesRange,
  listBucketKeys,
  parseDayKey,
  percentVariation,
  previousMonthKey,
} from './analytics-periods.js';

describe('analytics-periods', () => {
  describe('parseDayKey', () => {
    it('rechaza fechas inexistentes', () => {
      expect(() => parseDayKey('2026-02-31')).toThrow(BadRequestException);
    });

    it('rechaza formatos que no son YYYY-MM-DD', () => {
      expect(() => parseDayKey('2026/02/01')).toThrow(BadRequestException);
    });
  });

  describe('previousMonthKey', () => {
    it('retrocede al diciembre del año anterior desde enero', () => {
      expect(previousMonthKey('2025-01')).toBe('2024-12');
    });

    it('retrocede un mes dentro del mismo año', () => {
      expect(previousMonthKey('2025-03')).toBe('2025-02');
    });
  });

  describe('buildSeriesRange', () => {
    it('alinea el rango mensual a meses completos', () => {
      const range = buildSeriesRange('2024-01-15', '2024-03-10', 'month');

      expect(range.start.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(range.endExclusive.toISOString()).toBe('2024-04-01T00:00:00.000Z');
    });

    it('incluye el día "hasta" completo en granularidad diaria', () => {
      const range = buildSeriesRange('2024-03-01', '2024-03-03', 'day');

      expect(range.start.toISOString()).toBe('2024-03-01T00:00:00.000Z');
      expect(range.endExclusive.toISOString()).toBe('2024-03-04T00:00:00.000Z');
    });

    it('rechaza un rango invertido', () => {
      expect(() => buildSeriesRange('2024-03-05', '2024-03-01', 'day')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('listBucketKeys', () => {
    it('genera todos los días del rango, incluidos los extremos', () => {
      const range = buildSeriesRange('2024-02-28', '2024-03-01', 'day');

      expect(listBucketKeys(range, 'day')).toEqual([
        '2024-02-28',
        '2024-02-29',
        '2024-03-01',
      ]);
    });

    it('genera un bucket por mes', () => {
      const range = buildSeriesRange('2023-12-20', '2024-02-02', 'month');

      expect(listBucketKeys(range, 'month')).toEqual([
        '2023-12',
        '2024-01',
        '2024-02',
      ]);
    });
  });

  describe('percentVariation', () => {
    it('calcula la variación respecto al valor anterior', () => {
      expect(percentVariation(150000, 60000)).toBe(150);
    });

    it('usa el valor absoluto del anterior cuando es negativo', () => {
      expect(percentVariation(-50, -100)).toBe(50);
    });

    it('devuelve 0 cuando no hay base de comparación', () => {
      expect(percentVariation(1000, 0)).toBe(0);
    });

    it('redondea a dos decimales', () => {
      expect(percentVariation(1, 3)).toBe(-66.67);
    });
  });
});
