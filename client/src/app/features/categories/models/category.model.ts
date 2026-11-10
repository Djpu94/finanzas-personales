export const CATEGORY_TYPES = ['income', 'expense'] as const;

export type CategoryType = (typeof CATEGORY_TYPES)[number];

export interface CategoryTypeOption {
  value: CategoryType;
  label: string;
}

export const CATEGORY_TYPE_OPTIONS: readonly CategoryTypeOption[] = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
];

export const DEFAULT_CATEGORY_COLOR = '#607d8b';

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  type: CategoryType;
  color: string;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

export interface CreateCategoryRequest {
  name: string;
  parentId: string | null;
  type: CategoryType;
  color: string;
  icon: string | null;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;
