// Importes en centavos. Porcentaje con dos decimales (150 = 150 %).
export interface BudgetProgress {
  id: string;
  categoryId: string;
  // Formato yyyy-MM.
  period: string;
  limitAmount: number;
  alertsEnabled: boolean;
  spent: number;
  percentage: number;
}

export type BudgetAlertLevel = 'warning' | 'exceeded';

export interface BudgetAlert {
  budgetId: string;
  categoryId: string;
  period: string;
  limitAmount: number;
  spent: number;
  percentage: number;
  level: BudgetAlertLevel;
}

export interface CreateBudgetRequest {
  categoryId: string;
  period: string;
  limitAmount: number;
  alertsEnabled: boolean;
}

export type UpdateBudgetRequest = Partial<CreateBudgetRequest>;
