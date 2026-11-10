import type { Types } from 'mongoose';
import { parseMonthKey, toDayKey } from '../analytics/analytics-periods.js';
import type {
  Transaction,
  TransactionType,
} from '../transactions/transaction.schema.js';

export const REPORT_FORMATS = ['csv', 'pdf'] as const;

export type ReportFormat = (typeof REPORT_FORMATS)[number];

// Excel y Sheets detectan UTF-8 con BOM; sin él los acentos se rompen.
export const UTF8_BOM = '\uFEFF';

export const REPORT_CSV_COLUMNS = [
  'date',
  'type',
  'description',
  'amount',
  'account',
  'category',
  'tags',
] as const;

export type ReportTransactionSource = Pick<
  Transaction,
  | 'type'
  | 'amount'
  | 'date'
  | 'description'
  | 'accountId'
  | 'targetAccountId'
  | 'categoryId'
  | 'tagIds'
>;

export interface ReportNames {
  accounts: ReadonlyMap<string, string>;
  categories: ReadonlyMap<string, string>;
  tags: ReadonlyMap<string, string>;
}

export interface ReportRow {
  date: string;
  type: TransactionType;
  description: string;
  // Importe en unidades (2 decimales), no en centavos.
  amount: string;
  account: string;
  category: string;
  tags: string;
}

export interface MonthlySummary {
  // Importes en centavos.
  income: number;
  expense: number;
  balance: number;
}

const UNKNOWN_ACCOUNT = 'Cuenta desconocida';
const TAG_SEPARATOR = '; ';

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function monthTitle(period: string): string {
  const { start } = parseMonthKey(period);
  const label = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(start);
  return `Reporte ${label}`;
}

export function reportFileName(period: string, format: ReportFormat): string {
  return `reporte-${period}.${format}`;
}

export function toNameMap(
  documents: ReadonlyArray<{ _id: Types.ObjectId; name: string }>,
): Map<string, string> {
  return new Map(documents.map((document) => [String(document._id), document.name]));
}

export function toReportRow(
  transaction: ReportTransactionSource,
  names: ReportNames,
): ReportRow {
  const accountName = names.accounts.get(String(transaction.accountId));
  const account = accountName ?? UNKNOWN_ACCOUNT;
  const categoryId = transaction.categoryId ? String(transaction.categoryId) : null;
  const tags = transaction.tagIds
    .map((tagId) => names.tags.get(String(tagId)))
    .filter((name): name is string => name !== undefined);

  let accountLabel = account;
  if (transaction.type === 'transfer' && transaction.targetAccountId) {
    const targetName =
      names.accounts.get(String(transaction.targetAccountId)) ?? UNKNOWN_ACCOUNT;
    accountLabel = `${account} → ${targetName}`;
  }

  return {
    date: toDayKey(transaction.date),
    type: transaction.type,
    description: transaction.description,
    amount: formatCents(transaction.amount),
    account: accountLabel,
    category: (categoryId && names.categories.get(categoryId)) || '',
    tags: tags.join(TAG_SEPARATOR),
  };
}

// Las transferencias no cuentan como ingreso ni gasto.
export function summarizeMonth(
  transactions: ReadonlyArray<Pick<Transaction, 'type' | 'amount'>>,
): MonthlySummary {
  let income = 0;
  let expense = 0;
  for (const transaction of transactions) {
    if (transaction.type === 'income') {
      income += transaction.amount;
    } else if (transaction.type === 'expense') {
      expense += transaction.amount;
    }
  }
  return { income, expense, balance: income - expense };
}
