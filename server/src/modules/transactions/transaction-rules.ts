import { BadRequestException } from '@nestjs/common';
import type { TransactionType } from './transaction.schema.js';

export interface TransactionState {
  type: TransactionType;
  accountId: string;
  targetAccountId: string | null;
  categoryId: string | null;
  tagIds: string[];
}

export interface TransactionFilters {
  from?: Date;
  to?: Date;
  accountId?: string;
  categoryId?: string;
  tagId?: string;
  type?: TransactionType;
  search?: string;
}

const TRANSFER_REQUIRES_TARGET_MESSAGE =
  'Una transferencia necesita una cuenta de destino';
const TARGET_ONLY_FOR_TRANSFER_MESSAGE =
  'Solo las transferencias admiten cuenta de destino';
const TRANSFER_SAME_ACCOUNT_MESSAGE =
  'La cuenta de destino debe ser distinta de la de origen';
const TRANSFER_NO_CATEGORY_MESSAGE = 'Las transferencias no admiten categoría';
const INVALID_DATE_RANGE_MESSAGE =
  'La fecha "desde" no puede ser posterior a la fecha "hasta"';

export function assertValidTransactionState(state: TransactionState): void {
  if (state.type !== 'transfer') {
    if (state.targetAccountId) {
      throw new BadRequestException(TARGET_ONLY_FOR_TRANSFER_MESSAGE);
    }
    return;
  }

  if (!state.targetAccountId) {
    throw new BadRequestException(TRANSFER_REQUIRES_TARGET_MESSAGE);
  }
  if (state.targetAccountId === state.accountId) {
    throw new BadRequestException(TRANSFER_SAME_ACCOUNT_MESSAGE);
  }
  if (state.categoryId) {
    throw new BadRequestException(TRANSFER_NO_CATEGORY_MESSAGE);
  }
}

export function assertValidDateRange(from?: Date, to?: Date): void {
  if (from && to && from.getTime() > to.getTime()) {
    throw new BadRequestException(INVALID_DATE_RANGE_MESSAGE);
  }
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Una transferencia pertenece tanto a la cuenta de origen como a la de destino.
export function buildTransactionFilter(
  userId: string,
  filters: TransactionFilters,
): Record<string, unknown> {
  const filter: Record<string, unknown> = { userId };

  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) range.$gte = filters.from;
    if (filters.to) range.$lte = filters.to;
    filter.date = range;
  }
  if (filters.accountId) {
    filter.$or = [
      { accountId: filters.accountId },
      { targetAccountId: filters.accountId },
    ];
  }
  if (filters.categoryId) {
    filter.categoryId = filters.categoryId;
  }
  if (filters.tagId) {
    filter.tagIds = filters.tagId;
  }
  if (filters.type) {
    filter.type = filters.type;
  }
  if (filters.search) {
    filter.description = {
      $regex: escapeRegExp(filters.search),
      $options: 'i',
    };
  }

  return filter;
}
