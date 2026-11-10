import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MatDatepicker } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CategoriesStoreService } from '../../categories/services/categories-store.service';
import { conflictErrorMessage } from '../../../shared/utils/conflict-error-message';
import { MonthKey, toMonthKey } from '../../dashboard/utils/month';
import {
  BudgetProgress,
  CreateBudgetRequest,
} from '../models/budget.model';
import { BudgetsStoreService } from '../services/budgets-store.service';

export interface BudgetFormData {
  budget: BudgetProgress | null;
  period: MonthKey;
}

const MIN_LIMIT_AMOUNT = 0.01;

function monthKeyToDate(month: MonthKey): Date {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, 1);
}

@Component({
  selector: 'app-budget-form-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './budget-form-dialog.component.html',
  styleUrl: './budget-form-dialog.component.scss',
})
export class BudgetFormDialogComponent {
  private readonly data = inject<BudgetFormData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<BudgetFormDialogComponent, BudgetProgress>>(MatDialogRef);
  private readonly store = inject(BudgetsStoreService);
  private readonly categoriesStore = inject(CategoriesStoreService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly editing = this.data.budget;

  protected readonly title = this.editing ? 'Editar presupuesto' : 'Nuevo presupuesto';
  // Los presupuestos solo aplican a categorías de gasto.
  protected readonly categoryOptions = this.categoriesStore
    .indentedCategories()
    .filter((option) => option.category.type === 'expense');
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    categoryId: this.fb.control(this.editing?.categoryId ?? '', [
      Validators.required,
    ]),
    amount: this.fb.control<number | null>(
      this.editing ? this.editing.limitAmount / 100 : null,
      [Validators.required, Validators.min(MIN_LIMIT_AMOUNT)],
    ),
    period: this.fb.control<Date | null>(
      monthKeyToDate(this.editing?.period ?? this.data.period),
      [Validators.required],
    ),
    alertsEnabled: this.fb.control(this.editing?.alertsEnabled ?? true),
  });

  protected onMonthSelected(month: Date, picker: MatDatepicker<Date>): void {
    this.form.controls.period.setValue(month);
    picker.close();
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    const { categoryId, amount, period, alertsEnabled } = this.form.getRawValue();
    if (this.form.invalid || amount === null || period === null) {
      this.form.markAllAsTouched();
      return;
    }

    const request: CreateBudgetRequest = {
      categoryId,
      period: toMonthKey(period),
      limitAmount: Math.round(amount * 100),
      alertsEnabled,
    };

    const save$ = this.editing
      ? this.store.update(this.editing.id, request)
      : this.store.create(request);

    this.saving.set(true);
    save$.subscribe({
      next: (budget) => this.dialogRef.close(budget),
      error: (error: unknown) => {
        this.saving.set(false);
        this.snackBar.open(
          conflictErrorMessage(
            error,
            'No se pudo guardar el presupuesto. Inténtalo de nuevo.',
          ),
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
