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
import { CashFlowPoint } from '../models/dashboard.model';
import { readCssVariable } from '../utils/chart-helpers';
import { formatCurrencyUnits } from '../utils/format';
import { formatDayLabel } from '../utils/month';

const INCOME_FALLBACK_COLOR = '#2e7d32';
const EXPENSE_FALLBACK_COLOR = '#c62828';

@Component({
  selector: 'app-cash-flow-chart',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cash-flow-chart.component.html',
  styleUrl: './cash-flow-chart.component.scss',
})
export class CashFlowChartComponent {
  private readonly locale = inject(LOCALE_ID);
  private readonly theme = inject(ThemeService);

  readonly points = input.required<CashFlowPoint[]>();
  readonly currency = input.required<string>();

  protected readonly chartConfig = computed<ChartConfiguration<'line'>>(() => {
    // Leer el tema hace que el chart se recree al cambiarlo, con los colores nuevos.
    this.theme.resolvedTheme();
    const points = this.points();
    const currency = this.currency();
    const locale = this.locale;
    const incomeColor = readCssVariable(
      '--color-income',
      INCOME_FALLBACK_COLOR,
    );
    const expenseColor = readCssVariable(
      '--color-expense',
      EXPENSE_FALLBACK_COLOR,
    );
    const formatUnits = (value: number | string) =>
      formatCurrencyUnits(Number(value), currency, locale, 0);

    return {
      type: 'line',
      data: {
        labels: points.map((point) => formatDayLabel(point.date, locale)),
        datasets: [
          {
            label: 'Ingresos',
            data: points.map((point) => point.income / 100),
            borderColor: incomeColor,
            backgroundColor: incomeColor,
            tension: 0.3,
          },
          {
            label: 'Gastos',
            data: points.map((point) => point.expense / 100),
            borderColor: expenseColor,
            backgroundColor: expenseColor,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (value) => formatUnits(value) },
          },
        },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context) =>
                `${context.dataset.label}: ${formatUnits(context.parsed.y ?? 0)}`,
            },
          },
        },
      },
    };
  });
}
