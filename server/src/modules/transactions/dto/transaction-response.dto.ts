import type { TransactionType } from '../transaction.schema.js';

export interface TransactionResponseDto {
  id: string;
  type: TransactionType;
  amount: number;
  date: Date;
  description: string;
  accountId: string;
  targetAccountId: string | null;
  categoryId: string | null;
  tagIds: string[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionPageResponseDto {
  data: TransactionResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}
