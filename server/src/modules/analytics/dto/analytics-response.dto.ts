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
  budgetAlerts: unknown[];
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
