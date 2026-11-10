import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, merge } from 'rxjs';
import { AccountsStoreService } from '../../accounts/services/accounts-store.service';
import { CategoriesStoreService } from '../../categories/services/categories-store.service';
import { TagsStoreService } from '../../categories/services/tags-store.service';
import {
  EMPTY_TRANSACTION_FILTERS,
  PAGE_SIZE_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  Transaction,
  TransactionFilters,
  TransactionListQuery,
} from '../models/transaction.model';
import { TransactionsStoreService } from '../services/transactions-store.service';
import { currentMonthKey } from '../../dashboard/utils/month';
import {
  TransactionFormData,
  TransactionFormDialogComponent,
} from './transaction-form-dialog.component';
import {
  fromLocalDateString,
  hasActiveTransactionFilters,
  parseTransactionQuery,
  toLocalDateString,
  toQueryParams,
} from '../utils/transaction-query';

const SEARCH_DEBOUNCE_MS = 300;
const FALLBACK_CURRENCY = 'EUR';

@Component({
  selector: 'app-transactions-list',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transactions-list.component.html',
  styleUrl: './transactions-list.component.scss',
})
export class TransactionsListComponent {
  private readonly store = inject(TransactionsStoreService);
  private readonly accountsStore = inject(AccountsStoreService);
  private readonly categoriesStore = inject(CategoriesStoreService);
  private readonly tagsStore = inject(TagsStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  // La URL es la fuente de verdad: los filtros y la página se leen de aquí.
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly query = computed<TransactionListQuery>(() =>
    parseTransactionQuery(this.queryParams()),
  );

  protected readonly transactions = this.store.transactions;
  protected readonly total = this.store.total;
  protected readonly loading = this.store.loading;
  protected readonly error = this.store.error;
  protected readonly hasFilters = computed(() =>
    hasActiveTransactionFilters(this.query().filters),
  );

  protected readonly typeOptions = TRANSACTION_TYPE_OPTIONS;
  protected readonly displayedColumns = [
    'date',
    'description',
    'category',
    'account',
    'amount',
    'actions',
  ];
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly accounts = computed(() =>
    this.accountsStore.accounts().filter((account) => !account.isArchived),
  );
  protected readonly categoryOptions = this.categoriesStore.indentedCategories;

  // El reporte exporta un mes: el de la fecha "Desde" del filtro, o el actual si no hay.
  protected readonly exportPeriod = computed(
    () => this.query().filters.from?.slice(0, 7) ?? currentMonthKey(),
  );

  private readonly accountsById = computed(
    () => new Map(this.accountsStore.accounts().map((account) => [account.id, account])),
  );
  private readonly categoriesById = computed(
    () =>
      new Map(this.categoriesStore.categories().map((category) => [category.id, category])),
  );

  protected readonly filterForm = this.fb.group({
    range: this.fb.group({
      start: this.fb.control<Date | null>(null),
      end: this.fb.control<Date | null>(null),
    }),
    accountId: this.fb.control<string | null>(null),
    categoryId: this.fb.control<string | null>(null),
    type: this.fb.control<TransactionFilters['type']>(null),
    search: this.fb.control(''),
  });

  constructor() {
    this.accountsStore.load();
    this.categoriesStore.load();
    this.tagsStore.load();

    effect(() => {
      const query = this.query();
      untracked(() => this.syncFilterForm(query.filters));
      this.store.load(query);
    });

    merge(
      this.filterForm.controls.range.valueChanges,
      this.filterForm.controls.accountId.valueChanges,
      this.filterForm.controls.categoryId.valueChanges,
      this.filterForm.controls.type.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyFilters());

    this.filterForm.controls.search.valueChanges
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.applyFilters());
  }

  protected trackById(_index: number, transaction: Transaction): string {
    return transaction.id;
  }

  protected reload(): void {
    this.store.reload();
  }

  protected accountName(id: string | null): string {
    return id ? (this.accountsById().get(id)?.name ?? 'Cuenta desconocida') : '—';
  }

  protected currencyOf(accountId: string): string {
    return this.accountsById().get(accountId)?.currency ?? FALLBACK_CURRENCY;
  }

  protected category(id: string | null) {
    return id ? this.categoriesById().get(id) ?? null : null;
  }

  protected onPage(event: PageEvent): void {
    const query = this.query();
    const pageChanged = event.pageSize === query.pageSize;
    this.navigateTo({
      ...query,
      page: pageChanged ? event.pageIndex + 1 : 1,
      pageSize: event.pageSize,
    });
  }

  protected clearFilters(): void {
    this.navigateTo({ ...this.query(), filters: EMPTY_TRANSACTION_FILTERS, page: 1 });
  }

  protected openCreate(): void {
    this.openForm(null);
  }

  protected openEdit(transaction: Transaction): void {
    this.openForm(transaction);
  }

  protected delete(transaction: Transaction): void {
    if (!window.confirm(`¿Eliminar la transacción "${transaction.description}"?`)) {
      return;
    }

    this.store.delete(transaction.id).subscribe({
      next: () => {
        this.snackBar.open('Transacción eliminada.', 'Cerrar', { duration: 4000 });
        const query = this.query();
        // Si la página se queda vacía, se vuelve a la anterior.
        if (this.transactions().length === 0 && query.page > 1) {
          this.navigateTo({ ...query, page: query.page - 1 });
        }
      },
      error: () =>
        this.snackBar.open('No se pudo eliminar la transacción.', 'Cerrar', {
          duration: 5000,
        }),
    });
  }

  private openForm(transaction: Transaction | null): void {
    const data: TransactionFormData = { transaction };
    this.dialog
      .open<TransactionFormDialogComponent, TransactionFormData, Transaction>(
        TransactionFormDialogComponent,
        { data, width: '640px', autoFocus: 'first-tabbable' },
      )
      .afterClosed()
      .pipe(filter((saved): saved is Transaction => saved !== undefined))
      .subscribe(() =>
        this.snackBar.open(
          transaction ? 'Transacción actualizada.' : 'Transacción creada.',
          'Cerrar',
          { duration: 4000 },
        ),
      );
  }

  private syncFilterForm(filters: TransactionFilters): void {
    this.filterForm.patchValue(
      {
        range: {
          start: fromLocalDateString(filters.from),
          end: fromLocalDateString(filters.to),
        },
        accountId: filters.accountId,
        categoryId: filters.categoryId,
        type: filters.type,
        search: filters.search ?? '',
      },
      { emitEvent: false },
    );
  }

  // Cualquier cambio de filtro vuelve a la página 1 y se refleja en la URL.
  private applyFilters(): void {
    const { range, accountId, categoryId, type, search } = this.filterForm.getRawValue();
    const trimmedSearch = search.trim();

    this.navigateTo({
      ...this.query(),
      page: 1,
      filters: {
        from: range.start ? toLocalDateString(range.start) : null,
        to: range.end ? toLocalDateString(range.end) : null,
        accountId,
        categoryId,
        type,
        search: trimmedSearch === '' ? null : trimmedSearch,
      },
    });
  }

  private navigateTo(query: TransactionListQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(query),
      replaceUrl: true,
    });
  }
}
