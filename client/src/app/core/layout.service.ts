import { Injectable, computed, signal } from '@angular/core';

const SIDENAV_STORAGE_KEY = 'layout.sidenavOpened';

function readStoredDesktopState(): boolean {
  try {
    return localStorage.getItem(SIDENAV_STORAGE_KEY) !== 'false';
  } catch {
    // Sin acceso a localStorage el sidenav arranca abierto.
    return true;
  }
}

@Injectable({ providedIn: 'root' })
export class LayoutService {
  // En escritorio el estado se recuerda; en móvil el overlay siempre arranca cerrado.
  private readonly desktopOpened = signal(readStoredDesktopState());
  private readonly mobileOpened = signal(false);
  private readonly handset = signal(false);

  readonly isHandset = this.handset.asReadonly();
  readonly sidenavOpened = computed(() =>
    this.handset() ? this.mobileOpened() : this.desktopOpened(),
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
    this.persistDesktopState();
  }

  closeMobileSidenav(): void {
    this.mobileOpened.set(false);
  }

  private persistDesktopState(): void {
    try {
      localStorage.setItem(SIDENAV_STORAGE_KEY, String(this.desktopOpened()));
    } catch {
      // Si el almacenamiento no está disponible, el estado solo dura la sesión de la página.
    }
  }
}
