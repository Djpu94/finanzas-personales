import { Injectable, inject, signal } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import { Account } from '../../accounts/models/account.model';
import { AnalyticsOverview } from '../../dashboard/models/dashboard.model';
import { currentMonthKey } from '../../dashboard/utils/month';
import {
  Transaction,
  TransactionListResponse,
} from '../../transactions/models/transaction.model';
import { toStartOfLocalDayIso } from '../../transactions/utils/transaction-query';

const FALLBACK_CURRENCY = 'EUR';
const LOAD_ERROR_MESSAGE = 'No se pudo cargar el modo Zen.';

@Injectable({ providedIn: 'root' })
export class ZenStoreService {
  private readonly api = inject(ApiService);
  private loadSubscription?: Subscription;

  // Importe en centavos.
  readonly netWorth = signal<number | null>(null);
  readonly nextTransaction = signal<Transaction | null>(null);
  readonly currency = signal(FALLBACK_CURRENCY);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(): void {
    this.loadSubscription?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.loadSubscription = forkJoin({
      overview: this.api.get<AnalyticsOverview>('/analytics/overview', {
        month: currentMonthKey(),
      }),
      accounts: this.api.get<Account[]>('/accounts'),
      upcoming: this.api.get<TransactionListResponse>('/transactions', {
        from: toStartOfLocalDayIso(new Date()),
        sortBy: 'date',
        sortOrder: 'asc',
        page: '1',
        pageSize: '1',
      }),
    }).subscribe({
      next: ({ overview, accounts, upcoming }) => {
        this.netWorth.set(overview.netWorth);
        // Las cuentas no se convierten entre divisas: se usa la de la primera cuenta.
        this.currency.set(accounts[0]?.currency ?? FALLBACK_CURRENCY);
        this.nextTransaction.set(upcoming.data[0] ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(LOAD_ERROR_MESSAGE);
        this.loading.set(false);
      },
    });
  }
}
