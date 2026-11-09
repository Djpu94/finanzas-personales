import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, firstValueFrom, share, tap } from 'rxjs';
import { ApiService } from './api.service';
import { LoginRequest, RegisterRequest, User } from './models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly user = signal<User | null>(null);
  private refreshRequest: Observable<void> | null = null;

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);

  register(request: RegisterRequest): Observable<User> {
    return this.api.post<User>('/auth/register', request);
  }

  login(request: LoginRequest): Observable<User> {
    return this.api
      .post<User>('/auth/login', request)
      .pipe(tap((user) => this.user.set(user)));
  }

  logout(): Observable<void> {
    return this.api
      .post<void>('/auth/logout')
      .pipe(finalize(() => this.clearSession()));
  }

  // Las peticiones concurrentes que reciban 401 comparten un único refresh.
  refresh(): Observable<void> {
    this.refreshRequest ??= this.api.post<void>('/auth/refresh').pipe(
      finalize(() => (this.refreshRequest = null)),
      share(),
    );
    return this.refreshRequest;
  }

  // Sin sesión válida el usuario es invitado: no se bloquea el arranque de la app.
  async restoreSession(): Promise<void> {
    try {
      await firstValueFrom(this.me());
    } catch {
      this.clearSession();
    }
  }

  clearSession(): void {
    this.user.set(null);
  }

  private me(): Observable<User> {
    return this.api
      .get<User>('/auth/me')
      .pipe(tap((user) => this.user.set(user)));
  }
}
