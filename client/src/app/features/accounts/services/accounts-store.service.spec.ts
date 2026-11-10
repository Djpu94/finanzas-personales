import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Account } from '../models/account.model';
import { AccountsStoreService } from './accounts-store.service';

const ACCOUNT = {
  id: 'a1',
  name: 'Nómina',
  type: 'checking',
  initialBalance: 150050,
  currency: 'EUR',
  isArchived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as Account;

const OTHER = { ...ACCOUNT, id: 'a2', name: 'Ahorro' } as Account;

describe('AccountsStoreService', () => {
  let store: AccountsStoreService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AccountsStoreService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('load rellena la señal de cuentas', () => {
    store.load();
    http.expectOne('/api/accounts').flush([ACCOUNT, OTHER]);

    expect(store.accounts()).toEqual([ACCOUNT, OTHER]);
    expect(store.loading()).toBe(false);
  });

  it('load expone error si la petición falla', () => {
    store.load();
    http
      .expectOne('/api/accounts')
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });

  it('create añade la cuenta a la señal sin recargar', () => {
    store.load();
    http.expectOne('/api/accounts').flush([ACCOUNT]);

    store
      .create({
        name: 'Ahorro',
        type: 'savings',
        initialBalance: 0,
        currency: 'EUR',
      })
      .subscribe();
    http.expectOne('/api/accounts').flush(OTHER);

    expect(store.accounts()).toEqual([ACCOUNT, OTHER]);
  });

  it('update reemplaza la cuenta editada en la señal', () => {
    store.load();
    http.expectOne('/api/accounts').flush([ACCOUNT, OTHER]);

    const renamed = { ...ACCOUNT, name: 'Principal' };
    store.update('a1', { name: 'Principal' }).subscribe();
    http.expectOne('/api/accounts/a1').flush(renamed);

    expect(store.accounts()).toEqual([renamed, OTHER]);
  });

  it('archive quita la cuenta del listado sin recargar', () => {
    store.load();
    http.expectOne('/api/accounts').flush([ACCOUNT, OTHER]);

    store.archive('a1').subscribe();
    http
      .expectOne('/api/accounts/a1')
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(store.accounts()).toEqual([OTHER]);
  });
});
