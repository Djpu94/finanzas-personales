export function readCssVariable(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

// Los canvas no pueden usar variables CSS, así que los colores se leen del tema.
