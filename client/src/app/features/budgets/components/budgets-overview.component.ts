import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AccountsStoreService } from '../../accounts/services/accounts-store.service';
import { CategoriesStoreService } from '../../categories/services/categories-store.service';
import { DEFAULT_CATEGORY_COLOR } from '../../categories/models/category.model';
import { formatMonthLabel } from '../../dashboard/utils/month';
import { BudgetProgress } from '../models/budget.model';
import { BudgetsStoreService } from '../services/budgets-store.service';
import {
  BUDGET_STATUS_LABELS,
  BudgetStatus,
  budgetStatus,
} from '../utils/budget-status';
import {
  BudgetFormData,
  BudgetFormDialogComponent,
} from './budget-form-dialog.component';

const FALLBACK_CURRENCY = 'EUR';
const FALLBACK_CATEGORY_NAME = 'Categoría eliminada';

export interface BudgetCardItem {
  budget: BudgetProgress;
  name: string;
  color: string;
  status: BudgetStatus;
  statusLabel: string;
  // La barra nunca pasa del 100 %; el exceso lo indica el color y el texto.
  barValue: number;
}

@Component({
  selector: 'app-budgets-overview',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './budgets-overview.component.html',
  styleUrl: './budgets-overview.component.scss',
})
export class BudgetsOverviewComponent implements OnInit {
  protected readonly store = inject(BudgetsStoreService);
  private readonly categoriesStore = inject(CategoriesStoreService);
  private readonly accountsStore = inject(AccountsStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly locale = inject(LOCALE_ID);

  protected readonly monthLabel = computed(() =>
    formatMonthLabel(this.store.selectedMonth(), this.locale),
  );
  protected readonly currency = computed(
    () => this.accountsStore.accounts()[0]?.currency ?? FALLBACK_CURRENCY,
  );
  protected readonly items = computed<BudgetCardItem[]>(() => {
    const categories = new Map(
      this.categoriesStore.categories().map((category) => [category.id, category]),
    );
    return this.store.budgets().map((budget) => {
      const category = categories.get(budget.categoryId);
      const status = budgetStatus(budget.percentage);
      return {
        budget,
        name: category?.name ?? FALLBACK_CATEGORY_NAME,
        color: category?.color ?? DEFAULT_CATEGORY_COLOR,
        status,
        statusLabel: BUDGET_STATUS_LABELS[status],
        barValue: Math.min(budget.percentage, 100),
      };
    });
  });

  ngOnInit(): void {
    this.accountsStore.load();
    this.categoriesStore.load();
    this.store.load();
  }

  protected create(): void {
    this.openForm(null);
  }

  protected edit(budget: BudgetProgress): void {
    this.openForm(budget);
  }

  protected remove(item: BudgetCardItem): void {
    if (!window.confirm(`¿Eliminar el presupuesto de ${item.name}?`)) {
      return;
    }
    this.store.remove(item.budget.id).subscribe({
      next: () =>
        this.snackBar.open('Presupuesto eliminado.', 'Cerrar', { duration: 3000 }),
      error: () =>
        this.snackBar.open(
          'No se pudo eliminar el presupuesto. Inténtalo de nuevo.',
          'Cerrar',
          { duration: 5000 },
        ),
    });
  }

  protected trackById(_index: number, item: BudgetCardItem): string {
    return item.budget.id;
  }

  private openForm(budget: BudgetProgress | null): void {
    const data: BudgetFormData = {
      budget,
      period: budget?.period ?? this.store.selectedMonth(),
    };
    this.dialog
      .open<BudgetFormDialogComponent, BudgetFormData, BudgetProgress>(
        BudgetFormDialogComponent,
        { data, width: '480px', autoFocus: 'first-tabbable' },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open(
            budget ? 'Presupuesto actualizado.' : 'Presupuesto creado.',
            'Cerrar',
            { duration: 3000 },
          );
        }
      });
  }
}
