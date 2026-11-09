import { IsIn, IsOptional } from 'class-validator';

export const CATEGORY_LIST_FORMATS = ['flat', 'tree'] as const;

export type CategoryListFormat = (typeof CATEGORY_LIST_FORMATS)[number];

export class CategoryQueryDto {
  @IsOptional()
  @IsIn(CATEGORY_LIST_FORMATS)
  format?: CategoryListFormat;
}
