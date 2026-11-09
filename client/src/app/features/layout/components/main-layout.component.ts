import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, finalize } from 'rxjs';
import { AuthService } from '../../../core/auth.service';
import { LayoutService } from '../../../core/layout.service';

@Component({
  selector: 'app-main-layout',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly layout = inject(LayoutService);
  protected readonly user = this.auth.currentUser;
  protected readonly userInitial = computed(
    () => this.user()?.name.charAt(0).toUpperCase() ?? '?',
  );
  protected readonly loggingOut = signal(false);

  constructor() {
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(takeUntilDestroyed())
      .subscribe((state) => this.layout.setHandset(state.matches));

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.layout.closeMobileSidenav());
  }

  protected logout(): void {
    this.loggingOut.set(true);
    this.auth
      .logout()
      .pipe(finalize(() => void this.router.navigateByUrl('/login')))
      // La sesión local se limpia aunque la petición falle; por eso no se muestra error.
      .subscribe({ error: () => undefined });
  }
}
