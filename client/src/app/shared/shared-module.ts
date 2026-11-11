import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { CurrencyCentsPipe } from './pipes/currency-cents.pipe';
import { ChartContainerDirective } from './directives/chart-container.directive';
import { ReportExportMenuComponent } from './components/report-export-menu.component';
import { BannersComponent } from './components/banners.component';
import { OfflinePageComponent } from './components/offline-page.component';
import { EmptyStateComponent } from './components/empty-state.component';
import { LoadingSkeletonComponent } from './components/loading-skeleton.component';
import { ErrorStateComponent } from './components/error-state.component';

const SHARED_COMPONENTS = [
  CurrencyCentsPipe,
  ChartContainerDirective,
  ReportExportMenuComponent,
  BannersComponent,
  OfflinePageComponent,
  EmptyStateComponent,
  LoadingSkeletonComponent,
  ErrorStateComponent,
];

@NgModule({
  declarations: SHARED_COMPONENTS,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, RouterModule],
  exports: SHARED_COMPONENTS,
})
export class SharedModule {}
