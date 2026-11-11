import {
  EnvironmentInjector,
  Injectable,
  createEnvironmentInjector,
  importProvidersFrom,
  inject,
} from '@angular/core';
import type { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

// Carga Material snackbar solo cuando hay que notificar un error, fuera del bundle inicial.
@Injectable({ providedIn: 'root' })
export class SnackNotifierService {
  private readonly parent = inject(EnvironmentInjector);
  private snackBar: Promise<MatSnackBar> | null = null;

  open(message: string, action: string, config: MatSnackBarConfig): void {
    this.snackBar ??= import('@angular/material/snack-bar').then(
      ({ MatSnackBar: SnackBarToken, MatSnackBarModule }) =>
        createEnvironmentInjector(
          [importProvidersFrom(MatSnackBarModule)],
          this.parent,
        ).get(SnackBarToken),
    );
    void this.snackBar.then((snackBar) =>
      snackBar.open(message, action, config),
    );
  }
}
