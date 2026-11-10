import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';

@Pipe({
  name: 'currencyCents',
  standalone: false,
  pure: true,
})
export class CurrencyCentsPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  // Los importes llegan en centavos (entero); se formatean como moneda.
  transform(cents: number | null | undefined, currency: string): string {
    if (cents === null || cents === undefined) {
      return '';
    }
    return new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency,
    }).format(cents / 100);
  }
}
