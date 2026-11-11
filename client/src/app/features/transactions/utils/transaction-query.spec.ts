import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRANSACTION_QUERY,
  fromLocalDateString,
  parseTransactionQuery,
  toApiParams,
  toLocalDateString,
  toQueryParams,
} from './transaction-query';

const ACCOUNT_ID = '65a000000000000000000001';

function reader(values: Record<string, string>) {
  return { get: (name: string) => values[name] ?? null };
}

describe('transaction-query', () => {
  it('sin parámetros devuelve la consulta por defecto', () => {
    expect(parseTransactionQuery(reader({}))).toEqual(
      DEFAULT_TRANSACTION_QUERY,
    );
  });

  it('descarta valores inválidos en lugar de enviarlos al backend', () => {
    const query = parseTransactionQuery(
      reader({
        type: 'loan',
        accountId: 'no-es-un-id',
        page: '0',
        pageSize: '7',
        from: '2026-13-45',
        search: '   ',
      }),
    );

    expect(query.filters.type).toBeNull();
    expect(query.filters.accountId).toBeNull();
    expect(query.filters.from).toBeNull();
    expect(query.filters.search).toBeNull();
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(20);
  });

  it('descarta el límite superior si es anterior al inicial', () => {
    const query = parseTransactionQuery(
      reader({ from: '2026-02-10', to: '2026-02-01' }),
    );

    expect(query.filters.from).toBe('2026-02-10');
    expect(query.filters.to).toBeNull();
  });

  it('serializa solo los parámetros que difieren del valor por defecto', () => {
    const params = toQueryParams({
      filters: { ...DEFAULT_TRANSACTION_QUERY.filters, accountId: ACCOUNT_ID },
      page: 1,
      pageSize: 50,
    });

    expect(params).toEqual({
      from: null,
      to: null,
      accountId: ACCOUNT_ID,
      categoryId: null,
      type: null,
      search: null,
      page: null,
      pageSize: 50,
    });
  });

  it('convierte el rango de fechas en día local completo para el backend', () => {
    const params = toApiParams({
      filters: {
        ...DEFAULT_TRANSACTION_QUERY.filters,
        from: '2026-01-05',
        to: '2026-01-05',
      },
      page: 3,
      pageSize: 20,
    });

    const from = new Date(2026, 0, 5, 0, 0, 0, 0);
    const to = new Date(2026, 0, 5, 23, 59, 59, 999);
    expect(params['from']).toBe(from.toISOString());
    expect(params['to']).toBe(to.toISOString());
    expect(params['page']).toBe('3');
    expect(params['search']).toBeUndefined();
  });

  it('round-trip de fechas locales', () => {
    const date = fromLocalDateString('2026-03-09');
    expect(date).not.toBeNull();
    expect(toLocalDateString(date as Date)).toBe('2026-03-09');
  });
});
