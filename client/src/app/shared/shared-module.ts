import { NgModule } from '@angular/core';
import { CurrencyCentsPipe } from './pipes/currency-cents.pipe';

@NgModule({
  declarations: [CurrencyCentsPipe],
  exports: [CurrencyCentsPipe],
})
export class SharedModule {}
