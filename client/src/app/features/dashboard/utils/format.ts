export function formatCurrencyUnits(
  units: number,
  currency: string,
  locale: string,
  fractionDigits = 2,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: fractionDigits,
  }).format(units);
}

export function formatCurrencyCents(
  cents: number,
  currency: string,
  locale: string,
): string {
  return formatCurrencyUnits(cents / 100, currency, locale);
}
