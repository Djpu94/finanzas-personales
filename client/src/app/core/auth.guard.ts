import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ConnectivityService } from './connectivity.service';

// Sin red no hay login posible: se lleva a la página offline, que explica la situación.
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree([
    inject(ConnectivityService).online() ? '/login' : '/offline',
  ]);
};
