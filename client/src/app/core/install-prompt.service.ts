import { Injectable, computed, signal } from '@angular/core';

const DISMISSED_KEY = 'pwa.installDismissed';

// El evento no está tipado en lib.dom.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly deferredEvent = signal<BeforeInstallPromptEvent | null>(
    null,
  );
  private readonly dismissed = signal(readDismissed());

  readonly canInstall = computed(
    () => this.deferredEvent() !== null && !this.dismissed(),
  );

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredEvent.set(event as BeforeInstallPromptEvent);
    });
    window.addEventListener('appinstalled', () => this.deferredEvent.set(null));
  }

  async install(): Promise<void> {
    const event = this.deferredEvent();
    if (!event) {
      return;
    }
    // Un prompt solo puede usarse una vez.
    this.deferredEvent.set(null);
    await event.prompt();
  }

  dismiss(): void {
    this.dismissed.set(true);
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Sin almacenamiento, el aviso reaparece en la siguiente carga.
    }
  }
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}
