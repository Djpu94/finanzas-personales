import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from '@angular/core';
import { AnalyticsOverview } from '../models/dashboard.model';
import { formatCurrencyCents } from '../utils/format';

@Component({
  selector: 'app-verdict-row',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verdict-row.component.html',
  styleUrl: './verdict-row.component.scss',
})
export class VerdictRowComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly overview = input.required<AnalyticsOverview>();
  readonly currency = input.required<string>();

  protected readonly trend = computed(() => {
    const variation = this.overview().variationVsPreviousMonth;
    if (variation > 0) {
      return { icon: 'arrow_upward', tone: 'positive' };
    }
    if (variation < 0) {
      return { icon: 'arrow_downward', tone: 'negative' };
    }
    return { icon: 'drag_handle', tone: 'neutral' };
  });

  protected readonly variationText = computed(() =>
    new Intl.NumberFormat(this.locale, {
      style: 'percent',
      signDisplay: 'exceptZero',
      maximumFractionDigits: 1,
    }).format(this.overview().variationVsPreviousMonth / 100),
  );

  protected formatAmount(cents: number): string {
    return formatCurrencyCents(cents, this.currency(), this.locale);
  }
}
