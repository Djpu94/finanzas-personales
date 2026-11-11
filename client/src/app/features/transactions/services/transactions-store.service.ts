import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import { OfflineCacheService } from '../../../core/offline-cache.service';
import {
  BulkCreateTransactionsResponse,
  DEFAULT_PAGE_SIZE,
  EMPTY_TRANSACTION_FILTERS,
  Transaction,
  TransactionFilters,
  TransactionListQuery,
  TransactionListResponse,
  TransactionRequest,
} from '../models/transaction.model';
import { toApiParams } from '../utils/transaction-query';

@Injectable({ providedIn: 'root' })
export class TransactionsStoreService {
  private readonly api = inject(ApiService);
  private readonly offlineCache = inject(OfflineCacheService);
  private readonly transactionsState = signal<Transaction[]>([]);
  private readonly totalState = signal(0);
  private readonly pageState = signal(1);
  private readonly pageSizeState = signal(DEFAULT_PAGE_SIZE);
  private readonly filtersState = signal<TransactionFilters>(
    EMPTY_TRANSACTION_FILTERS,
  );
  private latestRequestId = 0;

  readonly transactions = this.transactionsState.asReadonly();
  readonly total = this.totalState.asReadonly();
  readonly page = this.pageState.asReadonly();
  readonly pageSize = this.pageSizeState.asReadonly();
  readonly filters = this.filtersState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Cada carga reemplaza los parámetros activos y pide la página al backend.
  // No lee señales: se invoca desde un effect del componente.
  load(query: TransactionListQuery): void {
    this.filtersState.set(query.filters);
    this.pageState.set(query.page);
    this.pageSizeState.set(query.pageSize);
    this.fetch(query);
  }

  reload(): void {
    this.fetch({
      filters: this.filtersState(),
      page: this.pageState(),
      pageSize: this.pageSizeState(),
    });
  }

  // No recarga la lista: el wizard de importación lo hace una vez al terminar todos los lotes.
  createBulk(
    requests: TransactionRequest[],
  ): Observable<BulkCreateTransactionsResponse> {
    return this.api
      .post<BulkCreateTransactionsResponse>('/transactions/bulk', requests)
      .pipe(tap(() => void this.offlineCache.invalidateTransactions()));
  }

  create(request: TransactionRequest): Observable<Transaction> {
    return this.api
      .post<Transaction>('/transactions', request, { silentErrors: true })
      .pipe(tap(() => this.invalidateAndReload()));
  }

  // Se recarga en lugar de parchear: la transacción editada puede dejar de cumplir los filtros.
  update(id: string, request: TransactionRequest): Observable<Transaction> {
    return this.api
      .patch<Transaction>(`/transactions/${id}`, request, {
        silentErrors: true,
      })
      .pipe(tap(() => this.invalidateAndReload()));
  }

  // Quita la fila localmente; si la página queda vacía, el componente decide la página anterior.
  // La caché de listas se invalida para que una recarga offline no muestre la fila borrada.
  delete(id: string): Observable<void> {
    return this.api.delete(`/transactions/${id}`, { silentErrors: true }).pipe(
      tap(() => {
        this.transactionsState.update((items) =>
          items.filter((item) => item.id !== id),
        );
        this.totalState.update((total) => Math.max(0, total - 1));
        void this.offlineCache.invalidateTransactions();
      }),
    );
  }

  // Tras una escritura la caché "performance" no debe servir listas anteriores.
  private invalidateAndReload(): void {
    void this.offlineCache.invalidateTransactions().then(() => this.reload());
  }

  private fetch(query: TransactionListQuery): void {
    const requestId = ++this.latestRequestId;

    this.loading.set(true);
    this.error.set(null);
    this.api
      .get<TransactionListResponse>('/transactions', toApiParams(query))
      .pipe(
        finalize(() => {
          if (requestId === this.latestRequestId) {
            this.loading.set(false);
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.latestRequestId) {
            return;
          }
          this.transactionsState.set(response.data);
          this.totalState.set(response.total);
        },
        error: () => {
          if (requestId !== this.latestRequestId) {
            return;
          }
          this.transactionsState.set([]);
          this.totalState.set(0);
          this.error.set('No se pudieron cargar las transacciones.');
        },
      });
  }
}
