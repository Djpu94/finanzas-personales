import type { BudgetAlertDto } from '../../budgets/dto/budget-response.dto.js';

export interface CategoryTotalDto {
  categoryId: string;
  name: string;
  total: number;
}

export interface AnalyticsOverviewResponseDto {
  netWorth: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyBalance: number;
  variationVsPreviousMonth: number;
  topExpenseCategories: CategoryTotalDto[];
  budgetAlerts: BudgetAlertDto[];
}

export interface CashFlowPointDto {
  date: string;
  income: number;
  expense: number;
}

export interface NetWorthPointDto {
  date: string;
  netWorth: number;
}

export interface AnalyticsSeriesResponseDto {
  cashFlow: CashFlowPointDto[];
  categoryDistribution: CategoryTotalDto[];
  netWorthEvolution: NetWorthPointDto[];
}
