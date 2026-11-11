import { Injectable } from '@angular/core';

// Nombres de los grupos de datos definidos en ngsw-config.json.
const BALANCES_GROUP = 'analytics-balances';
const TRANSACTIONS_GROUP = 'transactions-lists';

// Las cachés de ngsw tienen el formato ngsw:<scope>:<version>:data:<grupo>:cache
// (y sus metadatos db:ngsw:...). Se borran por grupo para no tocar los assets.
@Injectable({ providedIn: 'root' })
export class OfflineCacheService {
  invalidateTransactions(): Promise<void> {
    return this.deleteDataGroups([TRANSACTIONS_GROUP]);
  }

  clearAuthenticatedData(): Promise<void> {
    return this.deleteDataGroups([BALANCES_GROUP, TRANSACTIONS_GROUP]);
  }

  private async deleteDataGroups(groups: string[]): Promise<void> {
    if (typeof caches === 'undefined') {
      return;
    }
    try {
      const names = await caches.keys();
      const targets = names.filter(
        (name) =>
          name.includes('ngsw:') &&
          groups.some((group) => name.includes(`:data:${group}:`)),
      );
      await Promise.all(targets.map((name) => caches.delete(name)));
    } catch {
      // Sin acceso a Cache Storage no hay nada que limpiar.
    }
  }
}
