import { NgModule } from '@angular/core';
import { CurrencyCentsPipe } from './pipes/currency-cents.pipe';
import { ChartContainerDirective } from './directives/chart-container.directive';

@NgModule({
  declarations: [CurrencyCentsPipe, ChartContainerDirective],
  exports: [CurrencyCentsPipe, ChartContainerDirective],
})
export class SharedModule {}
