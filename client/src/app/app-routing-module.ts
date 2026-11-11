import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: '',
    loadChildren: () =>
      import('./features/auth/auth-module').then((m) => m.AuthModule),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/layout/layout-module').then((m) => m.LayoutModule),
  },
  {
    path: 'zen',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/zen/zen-module').then((m) => m.ZenModule),
  },
  {
    path: 'offline',
    loadChildren: () =>
      import('./features/offline/offline-module').then((m) => m.OfflineModule),
  },
  { path: '**', redirectTo: 'dashboard' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
