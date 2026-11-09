import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: '../../auth/auth.scss',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.currentUser;
  protected readonly loggingOut = signal(false);

  protected logout(): void {
    this.loggingOut.set(true);
    this.auth
      .logout()
      .pipe(finalize(() => void this.router.navigateByUrl('/login')))
      .subscribe();
  }
}
