export const BUDGET_WARNING_THRESHOLD = 80;
export const BUDGET_EXCEEDED_THRESHOLD = 100;

export type BudgetAlertLevel = 'warning' | 'exceeded';

export interface CategoryLink {
  id: string;
  parentId: string | null;
}

// Devuelve la categoría y todos sus descendientes (hijas, nietas, ...).
export function collectCategoryScope(
  categoryId: string,
  categories: CategoryLink[],
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (category.parentId) {
      const siblings = childrenByParent.get(category.parentId) ?? [];
      siblings.push(category.id);
      childrenByParent.set(category.parentId, siblings);
    }
  }

  const scope = [categoryId];
  const visited = new Set(scope);
  for (let index = 0; index < scope.length; index++) {
    for (const childId of childrenByParent.get(scope[index]) ?? []) {
      if (!visited.has(childId)) {
        visited.add(childId);
        scope.push(childId);
      }
    }
  }
  return scope;
}

export function sumSpentForScope(
  scopeIds: string[],
  totalsByCategoryId: Map<string, number>,
): number {
  return scopeIds.reduce(
    (sum, categoryId) => sum + (totalsByCategoryId.get(categoryId) ?? 0),
    0,
  );
}

// Porcentaje redondeado a 2 decimales respecto al límite.
export function computePercentage(spent: number, limitAmount: number): number {
  if (limitAmount <= 0) {
    return 0;
  }
  return Math.round((spent / limitAmount) * 10000) / 100;
}

export function resolveAlertLevel(percentage: number): BudgetAlertLevel | null {
  if (percentage >= BUDGET_EXCEEDED_THRESHOLD) {
    return 'exceeded';
  }
  if (percentage >= BUDGET_WARNING_THRESHOLD) {
    return 'warning';
  }
  return null;
}
