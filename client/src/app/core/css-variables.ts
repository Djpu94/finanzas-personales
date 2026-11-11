// Los canvas no pueden usar variables CSS: sus colores se leen de los tokens ya aplicados al body.
export function readCssVariable(name: string): string {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}
