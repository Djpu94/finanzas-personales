import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertValidDateRange,
  assertValidTransactionState,
  buildTransactionFilter,
  escapeRegExp,
} from './transaction-rules.js';

const accountA = '665f1a2b3c4d5e6f7a8b9c01';
const accountB = '665f1a2b3c4d5e6f7a8b9c02';
const categoryId = '665f1a2b3c4d5e6f7a8b9c03';

describe('assertValidTransactionState', () => {
  it('acepta un ingreso o gasto con categoría y sin cuenta de destino', () => {
    expect(() =>
      assertValidTransactionState({
        type: 'expense',
        accountId: accountA,
        targetAccountId: null,
        categoryId,
        tagIds: [],
      }),
    ).not.toThrow();
  });

  it('acepta una transferencia entre cuentas distintas sin categoría', () => {
    expect(() =>
      assertValidTransactionState({
        type: 'transfer',
        accountId: accountA,
        targetAccountId: accountB,
        categoryId: null,
        tagIds: [],
      }),
    ).not.toThrow();
  });

  it('rechaza una transferencia sin cuenta de destino', () => {
    expect(() =>
      assertValidTransactionState({
        type: 'transfer',
        accountId: accountA,
        targetAccountId: null,
        categoryId: null,
        tagIds: [],
      }),
    ).toThrow(BadRequestException);
  });

  it('rechaza una transferencia a la misma cuenta de origen', () => {
    expect(() =>
      assertValidTransactionState({
        type: 'transfer',
        accountId: accountA,
        targetAccountId: accountA,
        categoryId: null,
        tagIds: [],
      }),
    ).toThrow(BadRequestException);
  });

  it('rechaza una transferencia con categoría', () => {
    expect(() =>
      assertValidTransactionState({
        type: 'transfer',
        accountId: accountA,
        targetAccountId: accountB,
        categoryId,
        tagIds: [],
      }),
    ).toThrow(BadRequestException);
  });

  it('rechaza cuenta de destino en ingresos y gastos', () => {
    for (const type of ['income', 'expense'] as const) {
      expect(() =>
        assertValidTransactionState({
          type,
          accountId: accountA,
          targetAccountId: accountB,
          categoryId: null,
          tagIds: [],
        }),
      ).toThrow(BadRequestException);
    }
  });
});

describe('assertValidDateRange', () => {
  it('rechaza un rango con "desde" posterior a "hasta"', () => {
    expect(() =>
      assertValidDateRange(
        new Date('2024-02-01T00:00:00Z'),
        new Date('2024-01-01T00:00:00Z'),
      ),
    ).toThrow(BadRequestException);
  });

  it('acepta rangos válidos y rangos abiertos', () => {
    expect(() =>
      assertValidDateRange(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-02-01T00:00:00Z'),
      ),
    ).not.toThrow();
    expect(() =>
      assertValidDateRange(new Date('2024-01-01T00:00:00Z')),
    ).not.toThrow();
  });
});

describe('buildTransactionFilter', () => {
  const userId = '665f1a2b3c4d5e6f7a8b9c0d';

  it('siempre filtra por usuario y no añade criterios vacíos', () => {
    expect(buildTransactionFilter(userId, {})).toEqual({ userId });
  });

  it('combina rango de fechas, cuenta, tipo y categoría', () => {
    const from = new Date('2024-01-01T00:00:00Z');
    const to = new Date('2024-01-31T23:59:59Z');

    expect(
      buildTransactionFilter(userId, {
        from,
        to,
        accountId: accountA,
        type: 'expense',
        categoryId,
      }),
    ).toEqual({
      userId,
      date: { $gte: from, $lte: to },
      $or: [{ accountId: accountA }, { targetAccountId: accountA }],
      type: 'expense',
      categoryId,
    });
  });

  it('filtra por etiqueta con el campo tagIds', () => {
    expect(buildTransactionFilter(userId, { tagId: categoryId })).toEqual({
      userId,
      tagIds: categoryId,
    });
  });

  it('busca en description sin distinguir mayúsculas y escapando el texto', () => {
    expect(buildTransactionFilter(userId, { search: 'a+b (c)' })).toEqual({
      userId,
      description: { $regex: 'a\\+b \\(c\\)', $options: 'i' },
    });
  });
});

describe('escapeRegExp', () => {
  it('escapa los metacaracteres de expresiones regulares', () => {
    expect(escapeRegExp('.*+?^${}()|[]\\')).toBe(
      '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\',
    );
  });
});
