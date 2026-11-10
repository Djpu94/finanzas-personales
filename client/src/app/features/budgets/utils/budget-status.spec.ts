import { describe, expect, it } from 'vitest';
import { budgetStatus } from './budget-status';

describe('budgetStatus', () => {
  it.each([
    [0, 'ok'],
    [79.99, 'ok'],
    [80, 'warning'],
    [100, 'warning'],
    [100.01, 'exceeded'],
    [150, 'exceeded'],
  ])('%s %% -> %s', (percentage, expected) => {
    expect(budgetStatus(percentage)).toBe(expected);
  });
});
