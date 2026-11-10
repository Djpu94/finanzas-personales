import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MainLayoutComponent } from './components/main-layout.component';
import { PlaceholderPageComponent } from './components/placeholder-page.component';
import { SidenavMenuComponent } from './components/sidenav-menu.component';

const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('../dashboard/dashboard-module').then(
            (m) => m.DashboardModule,
          ),
      },
      {
        path: 'transactions',
        loadChildren: () =>
          import('../transactions/transactions-module').then(
            (m) => m.TransactionsModule,
          ),
      },
      {
        path: 'accounts',
        loadChildren: () =>
          import('../accounts/accounts-module').then((m) => m.AccountsModule),
      },
      {
        path: 'categories',
        loadChildren: () =>
          import('../categories/categories-module').then(
            (m) => m.CategoriesModule,
          ),
      },
      {
        path: 'budgets',
        loadChildren: () =>
          import('../budgets/budgets-module').then((m) => m.BudgetsModule),
      },
      {
        path: 'profile',
        component: PlaceholderPageComponent,
        data: { title: 'Perfil' },
      },
    ],
  },
];

@NgModule({
  declarations: [
    MainLayoutComponent,
    SidenavMenuComponent,
    PlaceholderPageComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
  ],
})
export class LayoutModule {}
