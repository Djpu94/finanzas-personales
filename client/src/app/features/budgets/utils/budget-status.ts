export type BudgetStatus = 'ok' | 'warning' | 'exceeded';

export const BUDGET_WARNING_THRESHOLD = 80;

// Por encima de este valor el presupuesto está excedido; en 100 exacto sigue en aviso.
export const BUDGET_EXCEEDED_THRESHOLD = 100;

export const BUDGET_STATUS_LABELS: Readonly<Record<BudgetStatus, string>> = {
  ok: 'En curso',
  warning: 'Cerca del límite',
  exceeded: 'Excedido',
};

export function budgetStatus(percentage: number): BudgetStatus {
  if (percentage > BUDGET_EXCEEDED_THRESHOLD) {
    return 'exceeded';
  }
  if (percentage >= BUDGET_WARNING_THRESHOLD) {
    return 'warning';
  }
  return 'ok';
}
