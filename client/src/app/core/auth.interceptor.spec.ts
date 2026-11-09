import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const PROTECTED_URL = '/api/tasks';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();
  });

  it('añade withCredentials a las peticiones', () => {
    client.get(PROTECTED_URL).subscribe();

    const req = http.expectOne(PROTECTED_URL);
    expect(req.request.withCredentials).toBe(true);
    req.flush([]);
  });

  it('reintenta una sola vez tras un refresh correcto', () => {
    let result: unknown;
    client.get(PROTECTED_URL).subscribe((value) => (result = value));

    http
      .expectOne(PROTECTED_URL)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush(null);
    http.expectOne(PROTECTED_URL).flush([{ id: 1 }]);

    expect(result).toEqual([{ id: 1 }]);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('comparte un único refresh entre peticiones concurrentes', () => {
    client.get(PROTECTED_URL).subscribe();
    client.get('/api/other').subscribe();

    http
      .expectOne(PROTECTED_URL)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    http
      .expectOne('/api/other')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    const refreshes = http.match('/api/auth/refresh');
    expect(refreshes).toHaveLength(1);
    refreshes[0].flush(null);
    http.expectOne(PROTECTED_URL).flush([]);
    http.expectOne('/api/other').flush([]);
  });

  it('limpia la sesión y redirige a /login cuando el refresh falla', () => {
    client.get(PROTECTED_URL).subscribe({ error: () => undefined });

    http
      .expectOne(PROTECTED_URL)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    http
      .expectOne('/api/auth/refresh')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('no intenta refresh para credenciales incorrectas en login', () => {
    client.post('/api/auth/login', {}).subscribe({ error: () => undefined });

    http
      .expectOne('/api/auth/login')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    http.expectNone('/api/auth/refresh');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
