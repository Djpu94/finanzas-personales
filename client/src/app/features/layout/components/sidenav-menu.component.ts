import { ChangeDetectionStrategy, Component } from '@angular/core';

interface SidenavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidenav-menu',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidenav-menu.component.html',
  styleUrl: './sidenav-menu.component.scss',
})
export class SidenavMenuComponent {
  protected readonly items: readonly SidenavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Transacciones', icon: 'swap_horiz', route: '/transactions' },
    { label: 'Cuentas', icon: 'account_balance_wallet', route: '/accounts' },
    { label: 'Categorías', icon: 'category', route: '/categories' },
    { label: 'Presupuestos', icon: 'savings', route: '/budgets' },
  ];
}
