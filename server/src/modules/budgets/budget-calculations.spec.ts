import { describe, expect, it } from 'vitest';
import {
  collectCategoryScope,
  computePercentage,
  resolveAlertLevel,
  sumSpentForScope,
} from './budget-calculations.js';

describe('budget calculations', () => {
  describe('collectCategoryScope', () => {
    it('devuelve solo la categoría cuando no tiene subcategorías', () => {
      const scope = collectCategoryScope('comida', [
        { id: 'comida', parentId: null },
        { id: 'transporte', parentId: null },
      ]);

      expect(scope).toEqual(['comida']);
    });

    it('incluye hijas y nietas, pero no hermanas ni padres', () => {
      const scope = collectCategoryScope('hogar', [
        { id: 'hogar', parentId: null },
        { id: 'suministros', parentId: 'hogar' },
        { id: 'luz', parentId: 'suministros' },
        { id: 'agua', parentId: 'suministros' },
        { id: 'alquiler', parentId: 'hogar' },
        { id: 'ocio', parentId: null },
      ]);

      expect(scope.sort()).toEqual(
        ['agua', 'alquiler', 'hogar', 'luz', 'suministros'].sort(),
      );
    });

    it('no entra en bucle si los datos contienen un ciclo', () => {
      const scope = collectCategoryScope('a', [
        { id: 'a', parentId: 'b' },
        { id: 'b', parentId: 'a' },
      ]);

      expect(scope.sort()).toEqual(['a', 'b']);
    });
  });

  describe('sumSpentForScope', () => {
    const totals = new Map([
      ['hogar', 1000],
      ['luz', 2500],
      ['ocio', 9999],
    ]);

    it('suma solo la categoría cuando no hay subcategorías con gasto', () => {
      expect(sumSpentForScope(['hogar'], totals)).toBe(1000);
    });

    it('suma la categoría y sus subcategorías con gasto', () => {
      expect(sumSpentForScope(['hogar', 'luz', 'agua'], totals)).toBe(3500);
    });

    it('devuelve cero si ninguna categoría del ámbito tiene gasto', () => {
      expect(sumSpentForScope(['agua'], totals)).toBe(0);
    });
  });

  describe('computePercentage', () => {
    it('redondea a dos decimales respecto al límite', () => {
      expect(computePercentage(1, 3)).toBe(33.33);
    });

    it('supera el 100% cuando el gasto excede el límite', () => {
      expect(computePercentage(15000, 10000)).toBe(150);
    });
  });

  describe('resolveAlertLevel', () => {
    it('no alerta por debajo del 80%', () => {
      expect(resolveAlertLevel(79.99)).toBeNull();
    });

    it('avisa desde el 80% y marca excedido desde el 100%', () => {
      expect(resolveAlertLevel(80)).toBe('warning');
      expect(resolveAlertLevel(99.99)).toBe('warning');
      expect(resolveAlertLevel(100)).toBe('exceeded');
    });
  });
});
