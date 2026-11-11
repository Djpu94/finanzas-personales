import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ThemeService } from '../../../core/theme.service';
import { DEFAULT_CATEGORY_COLOR } from '../../categories/models/category.model';
import { CategoriesStoreService } from '../../categories/services/categories-store.service';
import { CategoryTotal } from '../models/dashboard.model';
import { formatCurrencyCents, formatCurrencyUnits } from '../utils/format';

interface DistributionSlice {
  categoryId: string;
  name: string;
  total: number;
  color: string;
  share: number;
}

@Component({
  selector: 'app-category-donut',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-donut.component.html',
  styleUrl: './category-donut.component.scss',
})
export class CategoryDonutComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly categoriesStore = inject(CategoriesStoreService);
  private readonly theme = inject(ThemeService);

  readonly items = input.required<CategoryTotal[]>();
  readonly currency = input.required<string>();

  private readonly colorById = computed(
    () =>
      new Map(
        this.categoriesStore
          .categories()
          .map((category) => [category.id, category.color]),
      ),
  );

  protected readonly slices = computed<DistributionSlice[]>(() => {
    const colors = this.colorById();
    const items = this.items();
    const grandTotal = items.reduce((sum, item) => sum + item.total, 0);
    return items.map((item) => ({
      categoryId: item.categoryId,
      name: item.name,
      total: item.total,
      color: colors.get(item.categoryId) ?? DEFAULT_CATEGORY_COLOR,
      share: grandTotal > 0 ? item.total / grandTotal : 0,
    }));
  });

  protected readonly chartConfig = computed<ChartConfiguration<'doughnut'>>(
    () => {
      // Leer el tema recrea el chart con los colores de Chart.defaults del tema actual.
      this.theme.resolvedTheme();
      const slices = this.slices();
      return {
        type: 'doughnut',
        data: {
          labels: slices.map((slice) => slice.name),
          datasets: [
            {
              data: slices.map((slice) => slice.total / 100),
              backgroundColor: slices.map((slice) => slice.color),
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          cutout: '62%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) =>
                  `${context.label}: ${formatCurrencyUnits(context.parsed, this.currency(), this.locale)}`,
              },
            },
          },
        },
      };
    },
  );

  protected formatAmount(cents: number): string {
    return formatCurrencyCents(cents, this.currency(), this.locale);
  }

  protected formatShare(share: number): string {
    return new Intl.NumberFormat(this.locale, {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(share);
  }
}
