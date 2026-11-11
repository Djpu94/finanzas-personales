import { Injectable, computed, signal } from '@angular/core';

const SIDENAV_STORAGE_KEY = 'layout.sidenavOpened';
const SIDENAV_COLLAPSED_KEY = 'layout.sidenavCollapsed';

function readStoredFlag(key: string, defaultValue: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? defaultValue : stored === 'true';
  } catch {
    // Sin acceso a localStorage se usa el valor por defecto.
    return defaultValue;
  }
}

function persistFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Si el almacenamiento no está disponible, el estado solo dura la sesión de la página.
  }
}

@Injectable({ providedIn: 'root' })
export class LayoutService {
  // En escritorio el estado se recuerda; en móvil el overlay siempre arranca cerrado.
  private readonly desktopOpened = signal(
    readStoredFlag(SIDENAV_STORAGE_KEY, true),
  );
  private readonly desktopCollapsed = signal(
    readStoredFlag(SIDENAV_COLLAPSED_KEY, false),
  );
  private readonly mobileOpened = signal(false);
  private readonly handset = signal(false);

  readonly isHandset = this.handset.asReadonly();
  readonly sidenavOpened = computed(() =>
    this.handset() ? this.mobileOpened() : this.desktopOpened(),
  );
  // El modo colapsado (solo iconos) aplica únicamente en escritorio.
  readonly sidenavCollapsed = computed(
    () => !this.handset() && this.desktopCollapsed(),
  );

  setHandset(isHandset: boolean): void {
    this.handset.set(isHandset);
    if (!isHandset) {
      this.mobileOpened.set(false);
    }
  }

  toggleSidenav(): void {
    if (this.handset()) {
      this.mobileOpened.update((opened) => !opened);
      return;
    }
    this.desktopOpened.update((opened) => !opened);
    persistFlag(SIDENAV_STORAGE_KEY, this.desktopOpened());
  }

  toggleCollapsed(): void {
    this.desktopCollapsed.update((collapsed) => !collapsed);
    persistFlag(SIDENAV_COLLAPSED_KEY, this.desktopCollapsed());
  }

  closeMobileSidenav(): void {
    this.mobileOpened.set(false);
  }
}
