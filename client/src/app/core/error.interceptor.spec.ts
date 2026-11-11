import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorInterceptor } from './error.interceptor';
import { SILENT_HTTP_ERROR } from './silent-http-error';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    open = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: { open } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
  });

  async function requestFails(
    status: number,
    body: Record<string, unknown> | null = null,
    options: { context?: HttpContext } = {},
  ): Promise<unknown> {
    const result = new Promise<unknown>((resolve) => {
      http
        .get('/api/test', options)
        .subscribe({ error: (e: unknown) => resolve(e) });
    });
    controller.expectOne('/api/test').flush(body, {
      status,
      statusText: 'error',
    });
    return result;
  }

  it('shows a generic message for 5xx errors', async () => {
    await requestFails(500);
    expect(open).toHaveBeenCalledWith(
      'Algo salió mal. Inténtalo de nuevo.',
      'Cerrar',
      expect.any(Object),
    );
  });

  it('maps 403 and 404 to fixed messages', async () => {
    await requestFails(403);
    await requestFails(404);
    expect(open).toHaveBeenNthCalledWith(
      1,
      'Sin permiso para realizar esta acción.',
      'Cerrar',
      expect.any(Object),
    );
    expect(open).toHaveBeenNthCalledWith(
      2,
      'No se encontró el recurso solicitado.',
      'Cerrar',
      expect.any(Object),
    );
  });

  it('respects the backend message for 400 errors', async () => {
    await requestFails(400, { statusCode: 400, message: 'Monto inválido' });
    expect(open).toHaveBeenCalledWith(
      'Monto inválido',
      'Cerrar',
      expect.any(Object),
    );
  });

  it('joins validation array messages for 400 errors', async () => {
    await requestFails(400, { message: ['name vacío', 'amount inválido'] });
    expect(open).toHaveBeenCalledWith(
      'name vacío · amount inválido',
      'Cerrar',
      expect.any(Object),
    );
  });

  it('falls back to a 400 message when the body has no text', async () => {
    await requestFails(400, {});
    expect(open).toHaveBeenCalledWith(
      'Revisa los datos del formulario.',
      'Cerrar',
      expect.any(Object),
    );
  });

  it('does not show a snackbar for 401 responses', async () => {
    await requestFails(401);
    expect(open).not.toHaveBeenCalled();
  });

  it('skips the snackbar for silent requests but still propagates the error', async () => {
    const error = await requestFails(500, null, {
      context: new HttpContext().set(SILENT_HTTP_ERROR, true),
    });
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(open).not.toHaveBeenCalled();
  });
});
