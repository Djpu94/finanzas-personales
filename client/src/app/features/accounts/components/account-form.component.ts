import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AccountsStoreService } from '../services/accounts-store.service';
import {
  ACCOUNT_CURRENCIES,
  ACCOUNT_TYPE_OPTIONS,
  Account,
  AccountType,
  CreateAccountRequest,
} from '../models/account.model';

export interface AccountFormData {
  account: Account | null;
}

@Component({
  selector: 'app-account-form',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-form.component.html',
})
export class AccountFormComponent {
  private readonly data = inject<AccountFormData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<AccountFormComponent, Account>>(MatDialogRef);
  private readonly store = inject(AccountsStoreService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly editing = this.data.account;

  protected readonly title = this.editing ? 'Editar cuenta' : 'Nueva cuenta';
  protected readonly typeOptions = ACCOUNT_TYPE_OPTIONS;
  protected readonly currencies = ACCOUNT_CURRENCIES;
  protected readonly saving = signal(false);

  // El importe se edita en unidades (p. ej. 150.50) y se envía en centavos.
  protected readonly form = this.fb.group({
    name: this.fb.control(this.editing?.name ?? '', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    type: this.fb.control<AccountType>(this.editing?.type ?? 'checking', [
      Validators.required,
    ]),
    initialBalance: this.fb.control<number | null>(
      this.editing ? this.editing.initialBalance / 100 : 0,
      [Validators.required],
    ),
    currency: this.fb.control(this.editing?.currency ?? 'EUR', [
      Validators.required,
    ]),
  });

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    const { name, type, initialBalance, currency } = this.form.getRawValue();
    if (this.form.invalid || initialBalance === null) {
      this.form.markAllAsTouched();
      return;
    }

    const request: CreateAccountRequest = {
      name: name.trim(),
      type,
      initialBalance: Math.round(initialBalance * 100),
      currency,
    };

    const save$ = this.editing
      ? this.store.update(this.editing.id, request)
      : this.store.create(request);

    this.saving.set(true);
    save$.subscribe({
      next: (account) => this.dialogRef.close(account),
      error: (error: unknown) => {
        this.saving.set(false);
        this.snackBar.open(this.errorMessage(error), 'Cerrar', {
          duration: 5000,
        });
      },
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return 'Revisa los datos del formulario.';
    }
    return 'No se pudo guardar la cuenta. Inténtalo de nuevo.';
  }
}
