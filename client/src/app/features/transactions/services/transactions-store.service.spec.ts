import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_TRANSACTION_FILTERS,
  Transaction,
  TransactionListQuery,
  TransactionRequest,
} from '../models/transaction.model';
import { TransactionsStoreService } from './transactions-store.service';

const TRANSACTION = {
  id: 't1',
  type: 'expense',
  amount: 1250,
  date: '2026-01-10T00:00:00.000Z',
  description: 'Supermercado',
  accountId: 'a1',
  targetAccountId: null,
  categoryId: 'c1',
  tagIds: [],
  notes: null,
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
} as Transaction;

const OTHER = {
  ...TRANSACTION,
  id: 't2',
  description: 'Nómina',
} as Transaction;

const TRANSACTION_REQUEST: TransactionRequest = {
  type: 'expense',
  amount: 1250,
  date: '2026-01-10T00:00:00.000Z',
  description: 'Supermercado',
  accountId: 'a1',
  targetAccountId: null,
  categoryId: 'c1',
  tagIds: [],
  notes: null,
};

const QUERY: TransactionListQuery = {
  filters: { ...EMPTY_TRANSACTION_FILTERS, type: 'expense' },
  page: 2,
  pageSize: 10,
};

describe('TransactionsStoreService', () => {
  let store: TransactionsStoreService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(TransactionsStoreService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('load envía filtros y paginación al backend y rellena el estado', () => {
    store.load(QUERY);
    const request = http.expectOne((req) => req.url === '/api/transactions');
    expect(request.request.params.get('type')).toBe('expense');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');
    request.flush({ data: [TRANSACTION], total: 21, page: 2, pageSize: 10 });

    expect(store.transactions()).toEqual([TRANSACTION]);
    expect(store.total()).toBe(21);
    expect(store.page()).toBe(2);
    expect(store.pageSize()).toBe(10);
    expect(store.filters().type).toBe('expense');
    expect(store.loading()).toBe(false);
  });

  it('load expone error si la petición falla', () => {
    store.load(QUERY);
    http
      .expectOne((req) => req.url === '/api/transactions')
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(store.error()).toBeTruthy();
    expect(store.transactions()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('una respuesta antigua no sobrescribe la última petición', () => {
    store.load(QUERY);
    const first = http.expectOne((req) => req.url === '/api/transactions');
    store.load({ ...QUERY, page: 1 });
    const second = http.expectOne((req) => req.url === '/api/transactions');

    second.flush({ data: [OTHER], total: 1, page: 1, pageSize: 10 });
    first.flush({ data: [TRANSACTION], total: 99, page: 2, pageSize: 10 });

    expect(store.transactions()).toEqual([OTHER]);
    expect(store.total()).toBe(1);
  });

  it('create recarga el listado desde el backend', async () => {
    store.load(QUERY);
    http
      .expectOne((req) => req.url === '/api/transactions')
      .flush({ data: [], total: 0, page: 2, pageSize: 10 });

    store
      .create({
        type: 'expense',
        amount: 1250,
        date: '2026-01-10T00:00:00.000Z',
        description: 'Supermercado',
        accountId: 'a1',
        targetAccountId: null,
        categoryId: 'c1',
        tagIds: [],
        notes: null,
      })
      .subscribe();
    http.expectOne('/api/transactions').flush(TRANSACTION);
    // La recarga espera a invalidar la caché de listas antes de pedir al backend.
    await new Promise((resolve) => setTimeout(resolve));
    http
      .expectOne((req) => req.url === '/api/transactions')
      .flush({ data: [TRANSACTION], total: 1, page: 2, pageSize: 10 });

    expect(store.transactions()).toEqual([TRANSACTION]);
  });

  it('createBulk envía el lote sin recargar el listado', () => {
    const response = {
      inserted: 1,
      failed: 1,
      errors: [{ index: 1, message: 'Importe inválido' }],
    };
    let result: unknown;
    store
      .createBulk([TRANSACTION_REQUEST])
      .subscribe((value) => (result = value));

    const request = http.expectOne('/api/transactions/bulk');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual([TRANSACTION_REQUEST]);
    request.flush(response);

    expect(result).toEqual(response);
    expect(store.transactions()).toEqual([]);
  });

  it('delete quita la fila y descuenta el total sin recargar', () => {
    store.load({ ...QUERY, page: 1 });
    http
      .expectOne((req) => req.url === '/api/transactions')
      .flush({ data: [TRANSACTION, OTHER], total: 2, page: 1, pageSize: 10 });

    store.delete('t1').subscribe();
    http
      .expectOne('/api/transactions/t1')
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(store.transactions()).toEqual([OTHER]);
    expect(store.total()).toBe(1);
  });
});
