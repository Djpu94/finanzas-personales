import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Account } from '../../accounts/models/account.model';
import { AnalyticsOverview } from '../../dashboard/models/dashboard.model';
import { Transaction } from '../../transactions/models/transaction.model';
import { ZenStoreService } from './zen-store.service';

const OVERVIEW = { netWorth: 123456 } as AnalyticsOverview;

const ACCOUNT = { id: 'a1', currency: 'USD' } as Account;

const NEXT = {
  id: 't1',
  type: 'expense',
  amount: 2500,
  description: 'Alquiler',
  date: '2026-12-01T00:00:00.000Z',
} as Transaction;

describe('ZenStoreService', () => {
  let store: ZenStoreService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ZenStoreService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('load rellena saldo neto, moneda y próximo movimiento', () => {
    store.load();
    http
      .expectOne((req) => req.url === '/api/analytics/overview')
      .flush(OVERVIEW);
    http.expectOne((req) => req.url === '/api/accounts').flush([ACCOUNT]);
    http
      .expectOne(
        (req) =>
          req.url === '/api/transactions' &&
          req.params.get('sortOrder') === 'asc' &&
          req.params.get('pageSize') === '1',
      )
      .flush({ data: [NEXT], total: 1, page: 1, pageSize: 1 });

    expect(store.netWorth()).toBe(123456);
    expect(store.currency()).toBe('USD');
    expect(store.nextTransaction()).toEqual(NEXT);
    expect(store.loading()).toBe(false);
  });

  it('load deja el próximo movimiento a null si no hay futuros', () => {
    store.load();
    http
      .expectOne((req) => req.url === '/api/analytics/overview')
      .flush(OVERVIEW);
    http.expectOne((req) => req.url === '/api/accounts').flush([]);
    http
      .expectOne((req) => req.url === '/api/transactions')
      .flush({ data: [], total: 0, page: 1, pageSize: 1 });

    expect(store.nextTransaction()).toBeNull();
    expect(store.currency()).toBe('EUR');
  });

  it('load expone error si alguna petición falla', () => {
    store.load();
    http
      .expectOne((req) => req.url === '/api/analytics/overview')
      .flush(OVERVIEW);
    http.expectOne((req) => req.url === '/api/accounts').flush([ACCOUNT]);
    http
      .expectOne((req) => req.url === '/api/transactions')
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });
});
