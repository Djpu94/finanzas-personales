import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { CurrencyCentsPipe } from './pipes/currency-cents.pipe';
import { ChartContainerDirective } from './directives/chart-container.directive';
import { ReportExportMenuComponent } from './components/report-export-menu.component';

@NgModule({
  declarations: [CurrencyCentsPipe, ChartContainerDirective, ReportExportMenuComponent],
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  exports: [CurrencyCentsPipe, ChartContainerDirective, ReportExportMenuComponent],
})
export class SharedModule {}
