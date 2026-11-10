import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { CategoriesStoreService } from '../../categories/services/categories-store.service';
import { DEFAULT_CATEGORY_COLOR } from '../../categories/models/category.model';
import {
  BUDGET_STATUS_LABELS,
  BudgetStatus,
  budgetStatus,
} from '../../budgets/utils/budget-status';
import { BudgetProgress } from '../../budgets/models/budget.model';
import { DashboardStoreService } from '../services/dashboard-store.service';
import { formatMonthLabel } from '../utils/month';

const FALLBACK_CATEGORY_NAME = 'Categoría eliminada';

export interface AttentionItem {
  budgetId: string;
  name: string;
  color: string;
  status: Exclude<BudgetStatus, 'ok'>;
  statusLabel: string;
  budget: Pick<BudgetProgress, 'spent' | 'limitAmount' | 'percentage'>;
}

@Component({
  selector: 'app-dashboard',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  protected readonly store = inject(DashboardStoreService);
  private readonly categoriesStore = inject(CategoriesStoreService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly monthLabel = computed(() =>
    formatMonthLabel(this.store.selectedMonth(), this.locale),
  );

  // Recalcula el estado con el mismo criterio que el listado de presupuestos.
  protected readonly attentionItems = computed<AttentionItem[]>(() => {
    const alerts = this.store.overview()?.budgetAlerts ?? [];
    const categories = new Map(
      this.categoriesStore.categories().map((category) => [category.id, category]),
    );
    return alerts.flatMap((alert) => {
      const status = budgetStatus(alert.percentage);
      if (status === 'ok') {
        return [];
      }
      const category = categories.get(alert.categoryId);
      return [
        {
          budgetId: alert.budgetId,
          name: category?.name ?? FALLBACK_CATEGORY_NAME,
          color: category?.color ?? DEFAULT_CATEGORY_COLOR,
          status,
          statusLabel: BUDGET_STATUS_LABELS[status],
          budget: alert,
        },
      ];
    });
  });

  ngOnInit(): void {
    this.store.init();
    this.categoriesStore.load();
  }
}
