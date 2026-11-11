import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { CurrencyCentsPipe } from './pipes/currency-cents.pipe';
import { ChartContainerDirective } from './directives/chart-container.directive';
import { ReportExportMenuComponent } from './components/report-export-menu.component';
import { BannersComponent } from './components/banners.component';
import { OfflinePageComponent } from './components/offline-page.component';

@NgModule({
  declarations: [
    CurrencyCentsPipe,
    ChartContainerDirective,
    ReportExportMenuComponent,
    BannersComponent,
    OfflinePageComponent,
  ],
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  exports: [
    CurrencyCentsPipe,
    ChartContainerDirective,
    ReportExportMenuComponent,
    BannersComponent,
    OfflinePageComponent,
  ],
})
export class SharedModule {}
