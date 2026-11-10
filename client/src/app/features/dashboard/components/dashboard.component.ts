import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { DashboardStoreService } from '../services/dashboard-store.service';
import { formatMonthLabel } from '../utils/month';

@Component({
  selector: 'app-dashboard',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  protected readonly store = inject(DashboardStoreService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly monthLabel = computed(() =>
    formatMonthLabel(this.store.selectedMonth(), this.locale),
  );

  ngOnInit(): void {
    this.store.init();
  }
}
