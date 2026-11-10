import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import { AccountsStoreService } from '../../accounts/services/accounts-store.service';
import { CategoriesStoreService } from '../../categories/services/categories-store.service';
import {
  Transaction,
  TransactionListResponse,
} from '../../transactions/models/transaction.model';
import { AnalyticsOverview, AnalyticsSeries } from '../models/dashboard.model';
import {
  MonthKey,
  currentMonthKey,
  monthDateRange,
  shiftMonth,
} from '../utils/month';

const RECENT_TRANSACTIONS_SIZE = 5;
const FALLBACK_CURRENCY = 'EUR';
const LOAD_ERROR_MESSAGE = 'No se pudo cargar el panel.';

@Injectable({ providedIn: 'root' })
export class DashboardStoreService {
  private readonly api = inject(ApiService);
  private readonly accountsStore = inject(AccountsStoreService);
  private readonly categoriesStore = inject(CategoriesStoreService);
  private monthSubscription?: Subscription;

  readonly selectedMonth = signal<MonthKey>(currentMonthKey());
  readonly isCurrentMonth = computed(
    () => this.selectedMonth() === currentMonthKey(),
  );
  readonly overview = signal<AnalyticsOverview | null>(null);
  readonly series = signal<AnalyticsSeries | null>(null);
  readonly recentTransactions = signal<Transaction[]>([]);
  // null mientras se desconoce el total (primera carga).
  readonly totalTransactions = signal<number | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  // Las cuentas no se convierten entre divisas: se muestra la de la primera cuenta.
  readonly currency = computed(
    () => this.accountsStore.accounts()[0]?.currency ?? FALLBACK_CURRENCY,
  );

  init(): void {
    this.accountsStore.load();
    this.categoriesStore.load();
    this.loadRecentTransactions();
    this.loadMonthData();
  }

  previousMonth(): void {
    this.selectMonth(shiftMonth(this.selectedMonth(), -1));
  }

  nextMonth(): void {
    if (!this.isCurrentMonth()) {
      this.selectMonth(shiftMonth(this.selectedMonth(), 1));
    }
  }

  private selectMonth(month: MonthKey): void {
    this.selectedMonth.set(month);
    this.loadMonthData();
  }

  private loadMonthData(): void {
    const month = this.selectedMonth();
    const { from, to } = monthDateRange(month);

    // Cancela la petición anterior para que una respuesta tardía no pise el mes actual.
    this.monthSubscription?.unsubscribe();
    this.loading.set(true);
    this.monthSubscription = forkJoin({
      overview: this.api.get<AnalyticsOverview>('/analytics/overview', {
        month,
      }),
      series: this.api.get<AnalyticsSeries>('/analytics/series', {
        from,
        to,
        granularity: 'day',
      }),
    }).subscribe({
      next: ({ overview, series }) => {
        this.overview.set(overview);
        this.series.set(series);
        this.error.set(null);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(LOAD_ERROR_MESSAGE);
        this.loading.set(false);
      },
    });
  }

  private loadRecentTransactions(): void {
    this.api
      .get<TransactionListResponse>('/transactions', {
        page: '1',
        pageSize: String(RECENT_TRANSACTIONS_SIZE),
      })
      .subscribe({
        next: (response) => {
          this.recentTransactions.set(response.data);
          this.totalTransactions.set(response.total);
        },
        error: () => this.error.set(LOAD_ERROR_MESSAGE),
      });
  }
}
