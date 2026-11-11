import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from './theme.service';

type ChangeListener = (event: { matches: boolean }) => void;

function stubMatchMedia(initialDark: boolean) {
  const listeners: ChangeListener[] = [];
  const mql = {
    matches: initialDark,
    addEventListener: (_type: string, listener: ChangeListener) =>
      listeners.push(listener),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql as unknown as MediaQueryList);
  return {
    emit(matches: boolean) {
      listeners.forEach((listener) => listener({ matches }));
    },
  };
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove('dark-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createService(): ThemeService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  it('usa "system" por defecto cuando no hay preferencia guardada', () => {
    stubMatchMedia(false);
    const service = createService();

    expect(service.currentTheme()).toBe('system');
  });

  it('lee la preferencia guardada en localStorage', () => {
    stubMatchMedia(false);
    localStorage.setItem('theme.preference', 'dark');
    const service = createService();

    expect(service.currentTheme()).toBe('dark');
    expect(service.resolvedTheme()).toBe('dark');
  });

  it('ignora valores inválidos guardados en localStorage', () => {
    stubMatchMedia(false);
    localStorage.setItem('theme.preference', 'neon');
    const service = createService();

    expect(service.currentTheme()).toBe('system');
  });

  it('setTheme persiste la preferencia y aplica la clase dark-theme al body', () => {
    stubMatchMedia(false);
    const service = createService();

    service.setTheme('dark');

    expect(localStorage.getItem('theme.preference')).toBe('dark');
    expect(document.body.classList.contains('dark-theme')).toBe(true);

    service.setTheme('light');

    expect(localStorage.getItem('theme.preference')).toBe('light');
    expect(document.body.classList.contains('dark-theme')).toBe(false);
  });

  it('actualiza los colores por defecto de Chart.js según el tema', async () => {
    stubMatchMedia(false);
    const { Chart } = await import('chart.js');
    const service = createService();

    service.setTheme('dark');
    await vi.waitFor(() => expect(Chart.defaults.color).toBe('#cac4d0'));

    service.setTheme('light');
    await vi.waitFor(() => expect(Chart.defaults.color).toBe('#49454f'));
  });

  it('en modo "system" sigue la preferencia del SO en vivo', () => {
    const media = stubMatchMedia(false);
    const service = createService();

    service.setTheme('system');
    expect(service.resolvedTheme()).toBe('light');
    expect(document.body.classList.contains('dark-theme')).toBe(false);

    media.emit(true);

    expect(service.resolvedTheme()).toBe('dark');
    expect(document.body.classList.contains('dark-theme')).toBe(true);
  });

  it('en modo "dark" o "light" ignora los cambios del SO', () => {
    const media = stubMatchMedia(false);
    const service = createService();

    service.setTheme('light');
    media.emit(true);

    expect(service.resolvedTheme()).toBe('light');
    expect(document.body.classList.contains('dark-theme')).toBe(false);
  });
});
