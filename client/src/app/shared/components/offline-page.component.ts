import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-offline-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './offline-page.component.scss',
  templateUrl: './offline-page.component.html',
})
export class OfflinePageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly retrying = signal(false);

  protected async retry(): Promise<void> {
    this.retrying.set(true);
    await this.auth.restoreSession();
    this.retrying.set(false);
    void this.router.navigateByUrl('/');
  }
}
