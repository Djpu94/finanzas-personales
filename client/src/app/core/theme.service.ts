import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { loadChartJs } from './chart-loader';
import { readCssVariable } from './css-variables';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme.preference';
const DARK_CLASS = 'dark-theme';
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Respaldo solo para entornos sin hojas de estilo globales (p. ej. tests unitarios).
const CHART_FALLBACK_COLORS: Record<
  ResolvedTheme,
  { text: string; grid: string }
> = {
  light: { text: '#49454f', grid: 'rgba(0, 0, 0, 0.08)' },
  dark: { text: '#cac4d0', grid: 'rgba(255, 255, 255, 0.12)' },
};

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    // Sin acceso a localStorage se sigue la preferencia del sistema.
    return 'system';
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.(
    DARK_MEDIA_QUERY,
  );

  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly currentTheme = signal<ThemePreference>(readStoredPreference());
  readonly resolvedTheme = computed<ResolvedTheme>(() => {
    const theme = this.currentTheme();
    if (theme === 'system') {
      return this.systemDark() ? 'dark' : 'light';
    }
    return theme;
  });

  constructor() {
    // Se aplica de forma síncrona para que los charts creados después usen los colores correctos.
    this.applyResolvedTheme(this.resolvedTheme());
    this.media?.addEventListener('change', (event) => {
      this.systemDark.set(event.matches);
      this.applyResolvedTheme(this.resolvedTheme());
    });
  }

  setTheme(theme: ThemePreference): void {
    this.currentTheme.set(theme);
    this.applyResolvedTheme(this.resolvedTheme());
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Si el almacenamiento no está disponible, la preferencia dura solo la sesión.
    }
  }

  private applyResolvedTheme(theme: ResolvedTheme): void {
    const body = this.document.body;
    body.classList.toggle(DARK_CLASS, theme === 'dark');
    this.document.documentElement.style.colorScheme = theme;

    // Se leen después de cambiar la clase: los tokens del tema dependen de body.dark-theme.
    const fallback = CHART_FALLBACK_COLORS[theme];
    const textColor =
      readCssVariable('--color-text-secondary') || fallback.text;
    const gridColor =
      readCssVariable('--color-border-subtle') || fallback.grid;
    void loadChartJs().then(({ Chart }) => {
      Chart.defaults.color = textColor;
      Chart.defaults.borderColor = gridColor;
      // Solo se desactiva la animación; sin preferencia explícita se mantiene la de Chart.js.
      if (this.prefersReducedMotion()) {
        Chart.defaults.animation = false;
      }
    });
  }

  private prefersReducedMotion(): boolean {
    return (
      this.document.defaultView?.matchMedia?.(REDUCED_MOTION_QUERY).matches ??
      false
    );
  }
}
