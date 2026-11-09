import type { AccountType } from '../account.schema.js';

export interface AccountResponseDto {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currency: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
