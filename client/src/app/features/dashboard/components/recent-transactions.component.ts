import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  inject,
  input,
} from '@angular/core';
import {
  Transaction,
  TransactionType,
} from '../../transactions/models/transaction.model';
import { formatCurrencyCents } from '../utils/format';

@Component({
  selector: 'app-recent-transactions',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recent-transactions.component.html',
  styleUrl: './recent-transactions.component.scss',
})
export class RecentTransactionsComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly transactions = input.required<Transaction[]>();
  readonly currency = input.required<string>();

  protected formatAmount(cents: number): string {
    return formatCurrencyCents(cents, this.currency(), this.locale);
  }

  protected signFor(transaction: Transaction): string {
    return SIGN_BY_TYPE[transaction.type];
  }

  protected toneFor(transaction: Transaction): string {
    return TONE_BY_TYPE[transaction.type];
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
