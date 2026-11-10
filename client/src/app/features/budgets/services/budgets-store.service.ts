import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, finalize, tap } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import {
  MonthKey,
  currentMonthKey,
  shiftMonth,
} from '../../dashboard/utils/month';
import {
  BudgetProgress,
  CreateBudgetRequest,
  UpdateBudgetRequest,
} from '../models/budget.model';

const LOAD_ERROR_MESSAGE = 'No se pudieron cargar los presupuestos.';

@Injectable({ providedIn: 'root' })
export class BudgetsStoreService {
  private readonly api = inject(ApiService);
  private readonly selectedMonthState = signal<MonthKey>(currentMonthKey());
  private readonly budgetsState = signal<BudgetProgress[]>([]);
  private loadSubscription?: Subscription;

  readonly selectedMonth = this.selectedMonthState.asReadonly();
  readonly isCurrentMonth = computed(
    () => this.selectedMonthState() === currentMonthKey(),
  );
  readonly budgets = this.budgetsState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  previousMonth(): void {
    this.selectMonth(shiftMonth(this.selectedMonthState(), -1));
  }

  nextMonth(): void {
    if (!this.isCurrentMonth()) {
      this.selectMonth(shiftMonth(this.selectedMonthState(), 1));
    }
  }

  load(): void {
    // Cancela la carga anterior para que una respuesta tardía no pise otro mes.
    this.loadSubscription?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.loadSubscription = this.api
      .get<BudgetProgress[]>('/budgets', { period: this.selectedMonthState() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (budgets) => this.budgetsState.set(budgets),
        error: () => this.error.set(LOAD_ERROR_MESSAGE),
      });
  }

  create(request: CreateBudgetRequest): Observable<BudgetProgress> {
    return this.api
      .post<BudgetProgress>('/budgets', request)
      .pipe(tap((budget) => this.applyChange(budget)));
  }

  update(id: string, request: UpdateBudgetRequest): Observable<BudgetProgress> {
    return this.api
      .patch<BudgetProgress>(`/budgets/${id}`, request)
      .pipe(tap((budget) => this.applyChange(budget)));
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete(`/budgets/${id}`)
      .pipe(
        tap(() =>
          this.budgetsState.update((budgets) =>
            budgets.filter((budget) => budget.id !== id),
          ),
        ),
      );
  }

  private selectMonth(month: MonthKey): void {
    this.selectedMonthState.set(month);
    this.load();
  }

  // Un presupuesto movido a otro mes sale de la vista actual.
  private applyChange(budget: BudgetProgress): void {
    this.budgetsState.update((budgets) => {
      if (budget.period !== this.selectedMonthState()) {
        return budgets.filter((item) => item.id !== budget.id);
      }
      const exists = budgets.some((item) => item.id === budget.id);
      return exists
        ? budgets.map((item) => (item.id === budget.id ? budget : item))
        : [...budgets, budget];
    });
  }
}
