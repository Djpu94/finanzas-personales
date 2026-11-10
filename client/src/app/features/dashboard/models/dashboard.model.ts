import { BudgetAlert } from '../../budgets/models/budget.model';

export interface CategoryTotal {
  categoryId: string;
  name: string;
  // Importe en centavos.
  total: number;
}

export interface AnalyticsOverview {
  // Importes en centavos.
  netWorth: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyBalance: number;
  // Porcentaje (12.5 = 12,5 %).
  variationVsPreviousMonth: number;
  topExpenseCategories: CategoryTotal[];
  budgetAlerts: BudgetAlert[];
}

export interface CashFlowPoint {
  // Fecha en formato yyyy-MM-dd.
  date: string;
  income: number;
  expense: number;
}

export interface NetWorthPoint {
  date: string;
  netWorth: number;
}

export interface AnalyticsSeries {
  cashFlow: CashFlowPoint[];
  categoryDistribution: CategoryTotal[];
  netWorthEvolution: NetWorthPoint[];
}
