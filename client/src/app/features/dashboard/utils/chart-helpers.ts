export function readCssVariable(name: string, fallback: string): string {
  // Las variables de tema se redefinen en body.dark-theme, así que se leen desde body.
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

// Los canvas no pueden usar variables CSS, así que los colores se leen del tema.
