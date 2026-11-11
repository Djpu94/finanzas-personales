import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AccountsStoreService } from '../../accounts/services/accounts-store.service';
import { CategoriesStoreService } from '../../categories/services/categories-store.service';
import { TagsStoreService } from '../../categories/services/tags-store.service';
import { conflictErrorMessage } from '../../../shared/utils/conflict-error-message';
import {
  TRANSACTION_TYPE_OPTIONS,
  Transaction,
  TransactionRequest,
  TransactionType,
} from '../models/transaction.model';
import { TransactionsStoreService } from '../services/transactions-store.service';
import { toStartOfLocalDayIso } from '../utils/transaction-query';

export interface TransactionFormData {
  transaction: Transaction | null;
}

function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { required: true } : null;
}

@Component({
  selector: 'app-transaction-form-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transaction-form-dialog.component.html',
  styleUrl: './transaction-form-dialog.component.scss',
})
export class TransactionFormDialogComponent {
  private readonly data = inject<TransactionFormData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<TransactionFormDialogComponent, Transaction>>(
      MatDialogRef,
    );
  private readonly store = inject(TransactionsStoreService);
  private readonly accountsStore = inject(AccountsStoreService);
  private readonly categoriesStore = inject(CategoriesStoreService);
  private readonly tagsStore = inject(TagsStoreService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly editing = this.data.transaction;

  protected readonly title = this.editing
    ? 'Editar transacción'
    : 'Nueva transacción';
  protected readonly typeOptions = TRANSACTION_TYPE_OPTIONS;
  protected readonly saving = signal(false);
  protected readonly accounts = computed(() =>
    this.accountsStore.accounts().filter((account) => !account.isArchived),
  );
  protected readonly tags = this.tagsStore.tags;

  protected readonly form = this.fb.group({
    type: this.fb.control<TransactionType>(this.editing?.type ?? 'expense'),
    amount: this.fb.control<number | null>(
      this.editing ? this.editing.amount / 100 : null,
      [Validators.required, Validators.min(0.01)],
    ),
    date: this.fb.control<Date | null>(
      this.editing ? new Date(this.editing.date) : new Date(),
      [Validators.required],
    ),
    description: this.fb.control(this.editing?.description ?? '', [
      Validators.maxLength(500),
      notBlank,
    ]),
    accountId: this.fb.control<string | null>(this.editing?.accountId ?? null, [
      Validators.required,
    ]),
    categoryId: this.fb.control<string | null>(
      this.editing?.categoryId ?? null,
    ),
    targetAccountId: this.fb.control<string | null>(
      this.editing?.targetAccountId ?? null,
    ),
    tagIds: this.fb.control<string[]>(this.editing?.tagIds ?? []),
    notes: this.fb.control(this.editing?.notes ?? '', [
      Validators.maxLength(1000),
    ]),
  });

  protected readonly type = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });
  protected readonly isTransfer = computed(() => this.type() === 'transfer');

  // Las categorías se filtran por el tipo elegido; las transferencias no tienen categoría.
  protected readonly categoryOptions = computed(() => {
    const type = this.type();
    if (type === 'transfer') {
      return [];
    }
    return this.categoriesStore
      .indentedCategories()
      .filter((item) => item.category.type === type);
  });

  constructor() {
    this.form.controls.type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.applyTypeRules(type));
    this.applyTypeRules(this.form.controls.type.value);
  }

  protected sameAccount(): boolean {
    const { type, accountId, targetAccountId } = this.form.getRawValue();
    return (
      type === 'transfer' && accountId !== null && accountId === targetAccountId
    );
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    this.form.markAllAsTouched();
    const raw = this.form.getRawValue();
    const { amount, date, accountId } = raw;
    if (
      this.form.invalid ||
      this.sameAccount() ||
      amount === null ||
      date === null ||
      accountId === null
    ) {
      return;
    }

    const isTransfer = raw.type === 'transfer';
    const request: TransactionRequest = {
      type: raw.type,
      amount: Math.round(amount * 100),
      date: toStartOfLocalDayIso(date),
      description: raw.description.trim(),
      accountId,
      targetAccountId: isTransfer ? raw.targetAccountId : null,
      categoryId: isTransfer ? null : raw.categoryId,
      tagIds: raw.tagIds,
      notes: raw.notes.trim() === '' ? null : raw.notes.trim(),
    };

    const save$ = this.editing
      ? this.store.update(this.editing.id, request)
      : this.store.create(request);

    this.saving.set(true);
    save$.subscribe({
      next: (transaction) => this.dialogRef.close(transaction),
      error: (error: unknown) => {
        this.saving.set(false);
        this.snackBar.open(
          conflictErrorMessage(
            error,
            'No se pudo guardar la transacción. Inténtalo de nuevo.',
          ),
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  // Una transferencia exige cuenta destino y no tiene categoría; el resto no tiene cuenta destino.
  private applyTypeRules(type: TransactionType): void {
    const { targetAccountId, categoryId } = this.form.controls;

    if (type === 'transfer') {
      targetAccountId.setValidators(Validators.required);
      categoryId.setValue(null);
    } else {
      targetAccountId.clearValidators();
      targetAccountId.setValue(null);
      const currentCategory = categoryId.value;
      if (
        currentCategory !== null &&
        !this.categoryMatchesType(currentCategory, type)
      ) {
        categoryId.setValue(null);
      }
    }
    targetAccountId.updateValueAndValidity({ emitEvent: false });
  }

  private categoryMatchesType(
    categoryId: string,
    type: TransactionType,
  ): boolean {
    return this.categoriesStore
      .categories()
      .some((category) => category.id === categoryId && category.type === type);
  }
}
