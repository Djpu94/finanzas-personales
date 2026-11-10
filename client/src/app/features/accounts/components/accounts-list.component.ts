import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs';
import {
  Account,
  AccountType,
  findAccountTypeOption,
} from '../models/account.model';
import { AccountsStoreService } from '../services/accounts-store.service';
import {
  AccountFormComponent,
  AccountFormData,
} from './account-form.component';

@Component({
  selector: 'app-accounts-list',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accounts-list.component.html',
  styleUrl: './accounts-list.component.scss',
})
export class AccountsListComponent {
  private readonly store = inject(AccountsStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly accounts = this.store.accounts;
  protected readonly loading = this.store.loading;
  protected readonly error = this.store.error;

  constructor() {
    this.store.load();
  }

  protected reload(): void {
    this.store.load();
  }

  protected typeLabel(type: AccountType): string {
    return findAccountTypeOption(type).label;
  }

  protected typeIcon(type: AccountType): string {
    return findAccountTypeOption(type).icon;
  }

  protected openCreate(): void {
    this.openForm(null);
  }

  protected openEdit(account: Account): void {
    this.openForm(account);
  }

  protected archive(account: Account): void {
    this.store.archive(account.id).subscribe({
      next: () =>
        this.snackBar.open('Cuenta archivada.', 'Cerrar', { duration: 4000 }),
      error: () =>
        this.snackBar.open('No se pudo archivar la cuenta.', 'Cerrar', {
          duration: 5000,
        }),
    });
  }

  private openForm(account: Account | null): void {
    const data: AccountFormData = { account };
    this.dialog
      .open<AccountFormComponent, AccountFormData, Account>(
        AccountFormComponent,
        {
          data,
          width: '440px',
          autoFocus: 'first-tabbable',
        },
      )
      .afterClosed()
      .pipe(filter((saved): saved is Account => saved !== undefined))
      .subscribe(() =>
        this.snackBar.open(
          account ? 'Cuenta actualizada.' : 'Cuenta creada.',
          'Cerrar',
          { duration: 4000 },
        ),
      );
  }
}
