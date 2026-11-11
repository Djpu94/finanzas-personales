import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { SILENT_HTTP_ERROR } from './silent-http-error';

const SNACKBAR_DURATION_MS = 5000;

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'Revisa los datos del formulario.',
  403: 'Sin permiso para realizar esta acción.',
  404: 'No se encontró el recurso solicitado.',
  409: 'Ya existe un registro con esos datos.',
};

// Debe ir después de authInterceptor: el 401 ya gestionó el refresh y la sesión.
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        !req.context.get(SILENT_HTTP_ERROR) &&
        shouldNotify(error.status)
      ) {
        snackBar.open(errorMessage(error), 'Cerrar', {
          duration: SNACKBAR_DURATION_MS,
        });
      }
      return throwError(() => error);
    }),
  );
};

function shouldNotify(status: number): boolean {
  return status !== 0 && status !== 401 && status >= 400;
}

function errorMessage(error: HttpErrorResponse): string {
  if (error.status >= 500) {
    return 'Algo salió mal. Inténtalo de nuevo.';
  }
  // Los 400 y 409 traen un mensaje legible del backend; se respeta.
  if (error.status === 400 || error.status === 409) {
    const backendMessage = readBackendMessage(error.error);
    if (backendMessage) {
      return backendMessage;
    }
  }
  return FALLBACK_MESSAGES[error.status] ?? 'No se pudo completar la acción.';
}

// Nest puede devolver `message` como texto o como lista de validaciones.
function readBackendMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return null;
  }
  const message: unknown = body.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  if (Array.isArray(message)) {
    const texts = message.filter(
      (item): item is string => typeof item === 'string',
    );
    return texts.length ? texts.join(' · ') : null;
  }
  return null;
}
