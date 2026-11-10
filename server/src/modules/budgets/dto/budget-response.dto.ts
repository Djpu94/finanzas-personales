import type { BudgetAlertLevel } from '../budget-calculations.js';

export interface BudgetProgressDto {
  id: string;
  categoryId: string;
  period: string;
  limitAmount: number;
  alertsEnabled: boolean;
  spent: number;
  percentage: number;
}

export interface BudgetAlertDto {
  budgetId: string;
  categoryId: string;
  period: string;
  limitAmount: number;
  spent: number;
  percentage: number;
  level: BudgetAlertLevel;
}
