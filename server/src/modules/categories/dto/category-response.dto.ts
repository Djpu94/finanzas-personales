import { CategoryType } from '../category.schema.js';

export interface CategoryResponseDto {
  id: string;
  name: string;
  parentId: string | null;
  type: CategoryType;
  color: string;
  icon: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryTreeNodeDto extends CategoryResponseDto {
  children: CategoryTreeNodeDto[];
}
