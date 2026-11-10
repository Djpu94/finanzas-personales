import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import {
  formatCents,
  monthTitle,
  reportFileName,
  summarizeMonth,
  toNameMap,
  toReportRow,
  UTF8_BOM,
  type ReportNames,
} from './report-rules.js';

const accountId = new Types.ObjectId();
const targetAccountId = new Types.ObjectId();
const categoryId = new Types.ObjectId();
const tagId = new Types.ObjectId();

const names: ReportNames = {
  accounts: new Map([
    [String(accountId), 'Banco'],
    [String(targetAccountId), 'Ahorros'],
  ]),
  categories: new Map([[String(categoryId), 'Comida']]),
  tags: new Map([[String(tagId), 'viaje']]),
};

describe('formatCents', () => {
  it('convierte centavos a dos decimales', () => {
    expect(formatCents(12345)).toBe('123.45');
    expect(formatCents(5)).toBe('0.05');
    expect(formatCents(0)).toBe('0.00');
  });
});

describe('monthTitle y reportFileName', () => {
  it('genera el título en español y el nombre de archivo del patrón', () => {
    expect(monthTitle('2024-03')).toBe('Reporte marzo de 2024');
    expect(reportFileName('2024-03', 'csv')).toBe('reporte-2024-03.csv');
    expect(reportFileName('2024-03', 'pdf')).toBe('reporte-2024-03.pdf');
  });

  it('expone el BOM UTF-8 que necesitan Excel y Sheets', () => {
    expect(UTF8_BOM).toBe('\uFEFF');
  });
});

describe('toReportRow', () => {
  it('mapea un gasto con categoría y etiquetas', () => {
    const row = toReportRow(
      {
        type: 'expense',
        amount: 1550,
        date: new Date('2024-03-10T12:00:00.000Z'),
        description: 'Supermercado',
        accountId,
        targetAccountId: null,
        categoryId,
        tagIds: [tagId],
      },
      names,
    );

    expect(row).toEqual({
      date: '2024-03-10',
      type: 'expense',
      description: 'Supermercado',
      amount: '15.50',
      account: 'Banco',
      category: 'Comida',
      tags: 'viaje',
    });
  });

  it('deja categoría y etiquetas vacías cuando no existen', () => {
    const row = toReportRow(
      {
        type: 'income',
        amount: 100000,
        date: new Date('2024-03-01T00:00:00.000Z'),
        description: 'Nómina',
        accountId,
        targetAccountId: null,
        categoryId: null,
        tagIds: [],
      },
      names,
    );

    expect(row.category).toBe('');
    expect(row.tags).toBe('');
    expect(row.amount).toBe('1000.00');
  });

  it('muestra origen y destino en las transferencias', () => {
    const row = toReportRow(
      {
        type: 'transfer',
        amount: 2000,
        date: new Date('2024-03-05T00:00:00.000Z'),
        description: 'Ahorro',
        accountId,
        targetAccountId,
        categoryId: null,
        tagIds: [],
      },
      names,
    );

    expect(row.account).toBe('Banco → Ahorros');
  });

  it('usa un nombre de respaldo cuando la cuenta ya no existe', () => {
    const row = toReportRow(
      {
        type: 'expense',
        amount: 100,
        date: new Date('2024-03-05T00:00:00.000Z'),
        description: 'Huérfana',
        accountId: new Types.ObjectId(),
        targetAccountId: null,
        categoryId: null,
        tagIds: [],
      },
      names,
    );

    expect(row.account).toBe('Cuenta desconocida');
  });
});

describe('summarizeMonth', () => {
  it('suma ingresos y gastos, ignorando transferencias', () => {
    expect(
      summarizeMonth([
        { type: 'income', amount: 10000 },
        { type: 'expense', amount: 2500 },
        { type: 'transfer', amount: 9999 },
        { type: 'expense', amount: 500 },
      ]),
    ).toEqual({ income: 10000, expense: 3000, balance: 7000 });
  });

  it('devuelve ceros cuando no hay transacciones', () => {
    expect(summarizeMonth([])).toEqual({ income: 0, expense: 0, balance: 0 });
  });
});

describe('toNameMap', () => {
  it('indexa los nombres por id en texto', () => {
    const map = toNameMap([{ _id: accountId, name: 'Banco' }]);
    expect(map.get(String(accountId))).toBe('Banco');
  });
});
