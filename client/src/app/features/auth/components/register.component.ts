import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth.service';

function matchesPassword(control: AbstractControl): ValidationErrors | null {
  // Durante la construcción del grupo aún no hay parent; se valida después.
  if (!control.parent) {
    return null;
  }
  const password = control.parent.get('password')?.value;
  return control.value === password ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.component.html',
  styleUrl: '../auth.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly loading = signal(false);
  protected readonly form = this.fb.group({
    name: this.fb.control('', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    email: this.fb.control('', [Validators.required, Validators.email]),
    password: this.fb.control('', [
      Validators.required,
      Validators.minLength(8),
      Validators.maxLength(72),
    ]),
    confirmPassword: this.fb.control('', [
      Validators.required,
      matchesPassword,
    ]),
  });

  constructor() {
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() =>
        this.form.controls.confirmPassword.updateValueAndValidity(),
      );
  }

  protected submit(): void {
    if (this.loading()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.auth.register({ name, email, password }).subscribe({
      next: () => {
        this.snackBar.open('Cuenta creada. Inicia sesión.', 'Cerrar', {
          duration: 4000,
        });
        void this.router.navigateByUrl('/login');
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.snackBar.open(this.errorMessage(error), 'Cerrar', {
          duration: 5000,
        });
      },
    });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      return 'Ya existe una cuenta con ese email.';
    }
    return 'No se pudo crear la cuenta. Inténtalo de nuevo.';
  }
}
