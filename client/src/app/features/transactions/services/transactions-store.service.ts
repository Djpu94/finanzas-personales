import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import {
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
  private readonly transactionsState = signal<Transaction[]>([]);
  private readonly totalState = signal(0);
  private readonly pageState = signal(1);
  private readonly pageSizeState = signal(DEFAULT_PAGE_SIZE);
  private readonly filtersState = signal<TransactionFilters>(EMPTY_TRANSACTION_FILTERS);
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

  create(request: TransactionRequest): Observable<Transaction> {
    return this.api
      .post<Transaction>('/transactions', request)
      .pipe(tap(() => this.reload()));
  }

  // Se recarga en lugar de parchear: la transacción editada puede dejar de cumplir los filtros.
  update(id: string, request: TransactionRequest): Observable<Transaction> {
    return this.api
      .patch<Transaction>(`/transactions/${id}`, request)
      .pipe(tap(() => this.reload()));
  }

  // Quita la fila localmente; si la página queda vacía, el componente decide la página anterior.
  delete(id: string): Observable<void> {
    return this.api.delete(`/transactions/${id}`).pipe(
      tap(() => {
        this.transactionsState.update((items) =>
          items.filter((item) => item.id !== id),
        );
        this.totalState.update((total) => Math.max(0, total - 1));
      }),
    );
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
