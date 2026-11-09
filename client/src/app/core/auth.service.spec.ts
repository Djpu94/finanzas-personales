import {
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service';
import { User } from './models/user.model';

const USER = { id: '1', name: 'Ana', email: 'ana@example.com' } as User;

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('inicia sin sesión', () => {
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('login guarda el usuario en la señal', () => {
    service
      .login({ email: 'ana@example.com', password: '12345678' })
      .subscribe();

    http.expectOne('/api/auth/login').flush(USER);

    expect(service.currentUser()).toEqual(USER);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('logout limpia la sesión aunque la petición falle', () => {
    service.login({ email: 'ana@example.com', password: '12345678' }).subscribe();
    http.expectOne('/api/auth/login').flush(USER);

    service.logout().subscribe({ error: () => undefined });
    http
      .expectOne('/api/auth/logout')
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(service.isAuthenticated()).toBe(false);
  });

  it('restoreSession carga el usuario desde /me', async () => {
    const restore = service.restoreSession();
    http.expectOne('/api/auth/me').flush(USER);
    await restore;

    expect(service.currentUser()).toEqual(USER);
  });

  it('restoreSession deja al usuario como invitado si /me falla', async () => {
    const restore = service.restoreSession();
    http
      .expectOne('/api/auth/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await restore;

    expect(service.isAuthenticated()).toBe(false);
  });
});
