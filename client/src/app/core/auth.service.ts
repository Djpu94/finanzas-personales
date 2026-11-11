import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, finalize, firstValueFrom, share, tap } from 'rxjs';
import { ApiService } from './api.service';
import { ConnectivityService } from './connectivity.service';
import { OfflineCacheService } from './offline-cache.service';
import { LoginRequest, RegisterRequest, User } from './models/user.model';

// Solo se guarda el perfil mínimo para mostrar la sesión sin red; las cookies HttpOnly no son legibles aquí.
const PROFILE_KEY = 'auth.profile';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly offlineCache = inject(OfflineCacheService);
  private readonly user = signal<User | null>(null);
  private readonly offlineSessionState = signal(false);
  private refreshRequest: Observable<void> | null = null;

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);
  // Verdadero cuando la sesión proviene del perfil guardado porque no hay red.
  readonly offlineSession = this.offlineSessionState.asReadonly();

  constructor() {
    effect(() => {
      if (this.connectivity.online() && this.offlineSessionState()) {
        void this.restoreSession();
      }
    });
  }

  register(request: RegisterRequest): Observable<User> {
    return this.api.post<User>('/auth/register', request, {
      silentErrors: true,
    });
  }

  login(request: LoginRequest): Observable<User> {
    return this.api
      .post<User>('/auth/login', request, { silentErrors: true })
      .pipe(tap((user) => this.setUser(user)));
  }

  logout(): Observable<void> {
    return this.api
      .post<void>('/auth/logout')
      .pipe(finalize(() => this.clearSession()));
  }

  // Las peticiones concurrentes que reciban 401 comparten un único refresh.
  refresh(): Observable<void> {
    this.refreshRequest ??= this.api
      .post<void>('/auth/refresh', undefined, { silentErrors: true })
      .pipe(
        finalize(() => (this.refreshRequest = null)),
        share(),
      );
    return this.refreshRequest;
  }

  // Sin sesión válida el usuario es invitado: no se bloquea el arranque de la app.
  // Sin red se reutiliza el perfil guardado; un 401 real sí cierra la sesión.
  async restoreSession(): Promise<void> {
    try {
      await firstValueFrom(this.me());
    } catch (error) {
      const profile = this.isNetworkError(error)
        ? this.readStoredProfile()
        : null;
      if (profile) {
        this.user.set(profile);
        this.offlineSessionState.set(true);
        return;
      }
      this.clearSession();
    }
  }

  clearSession(): void {
    this.user.set(null);
    this.offlineSessionState.set(false);
    this.removeStoredProfile();
    void this.offlineCache.clearAuthenticatedData();
  }

  private me(): Observable<User> {
    return this.api
      .get<User>('/auth/me')
      .pipe(tap((user) => this.setUser(user)));
  }

  private setUser(user: User): void {
    this.user.set(user);
    this.offlineSessionState.set(false);
    this.storeProfile(user);
  }

  private isNetworkError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 0;
  }

  private storeProfile(user: User): void {
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ id: user.id, email: user.email, name: user.name }),
      );
    } catch {
      // Sin almacenamiento la sesión offline simplemente no estará disponible.
    }
  }

  private readStoredProfile(): User | null {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  private removeStoredProfile(): void {
    try {
      localStorage.removeItem(PROFILE_KEY);
    } catch {
      // Nada que limpiar si el almacenamiento no está disponible.
    }
  }
}
