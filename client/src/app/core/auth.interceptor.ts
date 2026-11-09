import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const PATHS_WITHOUT_REFRESH = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
];
const SESSION_RESTORE_PATH = '/api/auth/me';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const request = req.clone({ withCredentials: true });

  return next(request).pipe(
    catchError((error: unknown) => {
      const canRefresh =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !PATHS_WITHOUT_REFRESH.includes(req.url);

      if (!canRefresh) {
        return throwError(() => error);
      }

      // Un solo reintento: si el refresh falla, la sesión termina aquí.
      return auth.refresh().pipe(
        catchError((refreshError: unknown) => {
          auth.clearSession();
          // /me lo gestiona el guard al arrancar; evita redirigir a invitados.
          if (req.url !== SESSION_RESTORE_PATH) {
            void router.navigateByUrl('/login');
          }
          return throwError(() => refreshError);
        }),
        switchMap(() => next(request)),
      );
    }),
  );
};
