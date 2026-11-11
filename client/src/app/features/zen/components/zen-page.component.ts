import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  inject,
} from '@angular/core';
import { TransactionType } from '../../transactions/models/transaction.model';
import { ZenStoreService } from '../services/zen-store.service';

@Component({
  selector: 'app-zen-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zen-page.component.html',
  styleUrl: './zen-page.component.scss',
})
export class ZenPageComponent implements OnInit {
  protected readonly store = inject(ZenStoreService);
  protected readonly locale = inject(LOCALE_ID);

  ngOnInit(): void {
    this.store.load();
  }

  protected signFor(type: TransactionType): string {
    return SIGN_BY_TYPE[type];
  }

  protected toneFor(type: TransactionType): string {
    return TONE_BY_TYPE[type];
  }
}

const SIGN_BY_TYPE: Record<TransactionType, string> = {
  income: '+',
  expense: '−',
  transfer: '',
};

const TONE_BY_TYPE: Record<TransactionType, string> = {
  income: 'income',
  expense: 'expense',
  transfer: 'neutral',
};
