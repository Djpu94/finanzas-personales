import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  currentMonthKey,
  shiftMonth,
} from '../../dashboard/utils/month';
import { BudgetProgress } from '../models/budget.model';
import { BudgetsStoreService } from './budgets-store.service';

const MONTH = currentMonthKey();

const BUDGET: BudgetProgress = {
  id: 'b1',
  categoryId: 'c1',
  period: MONTH,
  limitAmount: 10000,
  alertsEnabled: true,
  spent: 8000,
  percentage: 80,
};

const OTHER: BudgetProgress = { ...BUDGET, id: 'b2', categoryId: 'c2' };

describe('BudgetsStoreService', () => {
  let store: BudgetsStoreService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(BudgetsStoreService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function loadMonth(budgets: BudgetProgress[]): void {
    store.load();
    http
      .expectOne((request) => request.url === '/api/budgets')
      .flush(budgets);
  }

  it('load pide los presupuestos del mes seleccionado', () => {
    store.load();
    const request = http.expectOne((r) => r.url === '/api/budgets');
    expect(request.request.params.get('period')).toBe(store.selectedMonth());
    request.flush([BUDGET, OTHER]);

    expect(store.budgets()).toEqual([BUDGET, OTHER]);
    expect(store.loading()).toBe(false);
  });

  it('load expone error si la petición falla', () => {
    store.load();
    http
      .expectOne((r) => r.url === '/api/budgets')
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });

  it('create añade el presupuesto del mes actual sin recargar', () => {
    loadMonth([BUDGET]);

    store
      .create({
        categoryId: 'c2',
        period: store.selectedMonth(),
        limitAmount: 10000,
        alertsEnabled: true,
      })
      .subscribe();
    http.expectOne('/api/budgets').flush(OTHER);

    expect(store.budgets()).toEqual([BUDGET, OTHER]);
  });

  it('update reemplaza el presupuesto editado sin recargar', () => {
    loadMonth([BUDGET, OTHER]);

    const updated = { ...BUDGET, limitAmount: 20000, percentage: 40 };
    store.update('b1', { limitAmount: 20000 }).subscribe();
    http.expectOne('/api/budgets/b1').flush(updated);

    expect(store.budgets()).toEqual([updated, OTHER]);
  });

  it('update saca el presupuesto de la vista si pasa a otro mes', () => {
    loadMonth([BUDGET, OTHER]);

    const nextMonth = shiftMonth(MONTH, 1);
    store.update('b1', { period: nextMonth }).subscribe();
    http.expectOne('/api/budgets/b1').flush({ ...BUDGET, period: nextMonth });

    expect(store.budgets()).toEqual([OTHER]);
  });

  it('remove quita el presupuesto sin recargar', () => {
    loadMonth([BUDGET, OTHER]);

    store.remove('b1').subscribe();
    http
      .expectOne('/api/budgets/b1')
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(store.budgets()).toEqual([OTHER]);
  });

  it('nextMonth no avanza más allá del mes actual', () => {
    const before = store.selectedMonth();
    store.nextMonth();
    expect(store.selectedMonth()).toBe(before);
  });
});
