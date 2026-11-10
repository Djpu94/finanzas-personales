import { Params } from '@angular/router';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_TRANSACTION_FILTERS,
  PAGE_SIZE_OPTIONS,
  TRANSACTION_TYPES,
  TransactionFilters,
  TransactionListQuery,
  TransactionType,
} from '../models/transaction.model';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONGO_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const SEARCH_MAX_LENGTH = 100;

interface QueryParamReader {
  get(name: string): string | null;
}

export const DEFAULT_TRANSACTION_QUERY: TransactionListQuery = {
  filters: EMPTY_TRANSACTION_FILTERS,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

// Lee la URL y descarta valores no válidos para que la lista nunca envíe
// parámetros que el backend rechazaría.
export function parseTransactionQuery(
  params: QueryParamReader,
): TransactionListQuery {
  const from = parseDate(params.get('from'));
  const toCandidate = parseDate(params.get('to'));
  const to = from && toCandidate && toCandidate < from ? null : toCandidate;

  return {
    filters: {
      from,
      to,
      accountId: parseMongoId(params.get('accountId')),
      categoryId: parseMongoId(params.get('categoryId')),
      type: parseType(params.get('type')),
      search: parseSearch(params.get('search')),
    },
    page: parsePositiveInt(params.get('page'), DEFAULT_TRANSACTION_QUERY.page),
    pageSize: parsePageSize(params.get('pageSize')),
  };
}

// Solo incluye los parámetros que difieren del valor por defecto.
export function toQueryParams(query: TransactionListQuery): Params {
  const { filters, page, pageSize } = query;
  return {
    from: filters.from,
    to: filters.to,
    accountId: filters.accountId,
    categoryId: filters.categoryId,
    type: filters.type,
    search: filters.search,
    page: page === DEFAULT_TRANSACTION_QUERY.page ? null : page,
    pageSize: pageSize === DEFAULT_TRANSACTION_QUERY.pageSize ? null : pageSize,
  };
}

export function toApiParams(query: TransactionListQuery): Record<string, string> {
  const { filters, page, pageSize } = query;
  const params: Record<string, string> = {
    page: String(page),
    pageSize: String(pageSize),
    sortBy: 'date',
    sortOrder: 'desc',
  };
  if (filters.from) {
    const from = fromLocalDateString(filters.from);
    if (!from) {
      throw new Error(`Fecha de filtro inválida: ${filters.from}`);
    }
    params['from'] = toStartOfLocalDayIso(from);
  }
  if (filters.to) {
    params['to'] = endOfLocalDayIso(filters.to);
  }
  if (filters.accountId) {
    params['accountId'] = filters.accountId;
  }
  if (filters.categoryId) {
    params['categoryId'] = filters.categoryId;
  }
  if (filters.type) {
    params['type'] = filters.type;
  }
  if (filters.search) {
    params['search'] = filters.search;
  }
  return params;
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromLocalDateString(value: string | null): Date | null {
  const match = value ? DATE_PATTERN.exec(value) : null;
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const isExactDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  return isExactDate ? date : null;
}

export function hasActiveTransactionFilters(filters: TransactionFilters): boolean {
  return (
    filters.from !== null ||
    filters.to !== null ||
    filters.accountId !== null ||
    filters.categoryId !== null ||
    filters.type !== null ||
    filters.search !== null
  );
}

export function toStartOfLocalDayIso(date: Date): string {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  ).toISOString();
}

// El backend filtra con `date <= to`, así que el límite superior es el final del día.
function endOfLocalDayIso(value: string): string {
  const date = fromLocalDateString(value);
  if (!date) {
    throw new Error(`Fecha de filtro inválida: ${value}`);
  }
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  ).toISOString();
}

function parseDate(value: string | null): string | null {
  return fromLocalDateString(value) ? (value as string) : null;
}

function parseMongoId(value: string | null): string | null {
  return value && MONGO_ID_PATTERN.test(value) ? value : null;
}

function parseType(value: string | null): TransactionType | null {
  return TRANSACTION_TYPES.find((type) => type === value) ?? null;
}

function parseSearch(value: string | null): string | null {
  const trimmed = value?.trim().slice(0, SEARCH_MAX_LENGTH) ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function parsePageSize(value: string | null): number {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}
