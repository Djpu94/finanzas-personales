import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { CurrencyCentsPipe } from './currency-cents.pipe';

describe('CurrencyCentsPipe', () => {
  let pipe: CurrencyCentsPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: LOCALE_ID, useValue: 'es-ES' }],
    });
    pipe = TestBed.runInInjectionContext(() => new CurrencyCentsPipe());
  });

  it('divide los centavos entre 100 y formatea con el locale', () => {
    const result = pipe.transform(1234567, 'EUR');

    expect(result).toContain('12.345,67');
    expect(result).toContain('€');
  });

  it('muestra cero como importe válido', () => {
    expect(pipe.transform(0, 'EUR')).toContain('0,00');
  });

  it('devuelve cadena vacía sin importe', () => {
    expect(pipe.transform(null, 'EUR')).toBe('');
    expect(pipe.transform(undefined, 'EUR')).toBe('');
  });
});
