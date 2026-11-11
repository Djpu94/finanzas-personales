export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface TransactionTypeOption {
  value: TransactionType;
  label: string;
}

export const TRANSACTION_TYPE_OPTIONS: readonly TransactionTypeOption[] = [
  { value: 'income', label: 'Ingreso' },
  { value: 'expense', label: 'Gasto' },
  { value: 'transfer', label: 'Transferencia' },
];

export function findTransactionTypeLabel(type: TransactionType): string {
  return (
    TRANSACTION_TYPE_OPTIONS.find((option) => option.value === type)?.label ??
    type
  );
}

export interface Transaction {
  id: string;
  type: TransactionType;
  // Importe en centavos, siempre positivo; el signo lo marca el tipo.
  amount: number;
  date: string;
  description: string;
  accountId: string;
  targetAccountId: string | null;
  categoryId: string | null;
  tagIds: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListResponse {
  data: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransactionRequest {
  type: TransactionType;
  amount: number;
  date: string;
  description: string;
  accountId: string;
  targetAccountId: string | null;
  categoryId: string | null;
  tagIds: string[];
  notes: string | null;
}

export interface BulkTransactionError {
  // Posición de la transacción dentro del lote enviado.
  index: number;
  message: string;
}

export interface BulkCreateTransactionsResponse {
  inserted: number;
  failed: number;
  errors: BulkTransactionError[];
}

export interface TransactionFilters {
  // Fechas en formato yyyy-MM-dd (día local).
  from: string | null;
  to: string | null;
  accountId: string | null;
  categoryId: string | null;
  type: TransactionType | null;
  search: string | null;
}

export interface TransactionListQuery {
  filters: TransactionFilters;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  from: null,
  to: null,
  accountId: null,
  categoryId: null,
  type: null,
  search: null,
};
