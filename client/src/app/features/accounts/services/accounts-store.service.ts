import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import {
  Account,
  CreateAccountRequest,
  UpdateAccountRequest,
} from '../models/account.model';

@Injectable({ providedIn: 'root' })
export class AccountsStoreService {
  private readonly api = inject(ApiService);
  private readonly accountsState = signal<Account[]>([]);

  readonly accounts = this.accountsState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .get<Account[]>('/accounts')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (accounts) => this.accountsState.set(accounts),
        error: () => this.error.set('No se pudieron cargar las cuentas.'),
      });
  }

  create(request: CreateAccountRequest): Observable<Account> {
    return this.api
      .post<Account>('/accounts', request)
      .pipe(
        tap((account) =>
          this.accountsState.update((accounts) => [...accounts, account]),
        ),
      );
  }

  update(id: string, request: UpdateAccountRequest): Observable<Account> {
    return this.api
      .patch<Account>(`/accounts/${id}`, request)
      .pipe(
        tap((updated) =>
          this.accountsState.update((accounts) =>
            accounts.map((account) => (account.id === id ? updated : account)),
          ),
        ),
      );
  }

  archive(id: string): Observable<void> {
    return this.api
      .delete(`/accounts/${id}`)
      .pipe(
        tap(() =>
          this.accountsState.update((accounts) =>
            accounts.filter((account) => account.id !== id),
          ),
        ),
      );
  }
}
