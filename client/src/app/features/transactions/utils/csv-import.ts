import Papa from 'papaparse';
import { TransactionRequest, TransactionType } from '../models/transaction.model';
import { toStartOfLocalDayIso } from './transaction-query';

export const CSV_MAX_BYTES = 5 * 1024 * 1024;
export const CSV_MAX_ROWS = 5000;
export const CSV_BULK_CHUNK_SIZE = 100;
export const CSV_MAPPING_STORAGE_KEY = 'csv-import.mappings';

const DELIMITER_CANDIDATES = [',', ';', '\t', '|'];
const DESCRIPTION_MAX_LENGTH = 500;
const SAMPLE_LINES = 20;

export type DateOrder = 'dmy' | 'mdy';
export type AmountMode = 'single' | 'split';

export interface CsvMapping {
  dateColumn: number;
  descriptionColumn: number;
  amountMode: AmountMode;
  // Modo "single": una columna con importe firmado (negativo = gasto).
  amountColumn: number | null;
  // Modo "split": columnas separadas de ingreso y gasto.
  incomeColumn: number | null;
  expenseColumn: number | null;
  dateOrder: DateOrder;
}

export interface CsvRecord {
  // Número de registro en el archivo; la cabecera cuenta como fila 1.
  row: number;
  cells: string[];
}

export interface ParsedCsv {
  delimiter: string;
  headers: string[];
  records: CsvRecord[];
}

export interface ImportRow {
  row: number;
  date: Date;
  description: string;
  // Importe en centavos, siempre positivo; el tipo lleva el signo.
  amount: number;
  type: Extract<TransactionType, 'income' | 'expense'>;
}

export interface ImportIssue {
  row: number;
  message: string;
}

export interface BuildImportResult {
  rows: ImportRow[];
  issues: ImportIssue[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function decodeCsvBytes(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, SAMPLE_LINES).join('\n');
  let best = DELIMITER_CANDIDATES[0];
  let bestScore = 0;

  for (const delimiter of DELIMITER_CANDIDATES) {
    const widths = Papa.parse<string[]>(sample, { delimiter, skipEmptyLines: true }).data.map(
      (cells) => cells.length,
    );
    const counts = new Map<number, number>();
    for (const width of widths) {
      counts.set(width, (counts.get(width) ?? 0) + 1);
    }
    for (const [width, count] of counts) {
      if (width >= 2 && count > bestScore) {
        best = delimiter;
        bestScore = count;
      }
    }
  }
  return best;
}

export function parseCsvText(text: string, delimiter: string): ParsedCsv {
  const records = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: false }).data;
  const headerIndex = records.findIndex(hasContent);
  if (headerIndex === -1) {
    return { delimiter, headers: [], records: [] };
  }

  const headers = records[headerIndex].map((cell) => cell.trim());
  const dataRecords: CsvRecord[] = [];
  for (let index = headerIndex + 1; index < records.length; index++) {
    if (hasContent(records[index])) {
      dataRecords.push({ row: index + 1, cells: records[index] });
    }
  }
  return { delimiter, headers, records: dataRecords };
}

export function headerFingerprint(headers: readonly string[]): string {
  const key = headers.map((header) => header.trim().toLowerCase()).join('|');
  let hash = 5381;
  for (let index = 0; index < key.length; index++) {
    hash = ((hash << 5) + hash + key.charCodeAt(index)) >>> 0;
  }
  return `${headers.length}-${hash.toString(16).padStart(8, '0')}`;
}

export function detectDateOrder(values: readonly string[]): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const value of values) {
    const match = SLASH_DATE.exec(value.trim());
    if (!match) {
      continue;
    }
    if (Number(match[1]) > 12) {
      dmy++;
    }
    if (Number(match[2]) > 12) {
      mdy++;
    }
  }
  return mdy > dmy ? 'mdy' : 'dmy';
}

const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/;
const SLASH_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

export function parseDate(raw: string, order: DateOrder): Date | null {
  const value = raw.trim();
  const iso = ISO_DATE.exec(value);
  if (iso) {
    return buildLocalDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const slash = SLASH_DATE.exec(value);
  if (!slash) {
    return null;
  }
  const first = Number(slash[1]);
  const second = Number(slash[2]);
  const year = Number(slash[3]);
  return order === 'dmy'
    ? buildLocalDate(year, second, first)
    : buildLocalDate(year, first, second);
}

// Devuelve el importe firmado en centavos, o null si no es un importe válido.
export function parseAmount(raw: string): number | null {
  const value = raw.trim();
  if (!/\d/.test(value)) {
    return null;
  }
  const negative = value.includes('-') || (value.startsWith('(') && value.endsWith(')'));
  const digits = value.replace(/[^\d.,]/g, '');

  const lastSeparator = Math.max(digits.lastIndexOf(','), digits.lastIndexOf('.'));
  let normalized: string;
  if (lastSeparator === -1) {
    normalized = digits;
  } else {
    const decimals = digits.length - lastSeparator - 1;
    const isDecimal = decimals === 1 || decimals === 2;
    normalized = isDecimal
      ? `${digits.slice(0, lastSeparator).replace(/[.,]/g, '')}.${digits.slice(lastSeparator + 1)}`
      : digits.replace(/[.,]/g, '');
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    return null;
  }
  const cents = Math.round(amount * 100);
  return negative ? -cents : cents;
}

export function buildImportRows(
  records: readonly CsvRecord[],
  mapping: CsvMapping,
): BuildImportResult {
  const rows: ImportRow[] = [];
  const issues: ImportIssue[] = [];

  for (const record of records) {
    const result = buildImportRow(record, mapping);
    if ('message' in result) {
      issues.push({ row: record.row, message: result.message });
    } else {
      rows.push(result);
    }
  }
  return { rows, issues };
}

export function toTransactionRequest(
  row: ImportRow,
  accountId: string,
  categoryId: string | null,
): TransactionRequest {
  return {
    type: row.type,
    amount: row.amount,
    date: toStartOfLocalDayIso(row.date),
    description: row.description,
    accountId,
    targetAccountId: null,
    categoryId,
    tagIds: [],
    notes: null,
  };
}

export function isMappingCompatible(mapping: CsvMapping, columnCount: number): boolean {
  const columns = [
    mapping.dateColumn,
    mapping.descriptionColumn,
    mapping.amountColumn,
    mapping.incomeColumn,
    mapping.expenseColumn,
  ];
  return columns.every(
    (column) => column === null || (Number.isInteger(column) && column >= 0 && column < columnCount),
  );
}

export function loadSavedMapping(
  fingerprint: string,
  storage: StorageLike = localStorage,
): CsvMapping | null {
  return readMappings(storage)[fingerprint] ?? null;
}

export function saveMapping(
  fingerprint: string,
  mapping: CsvMapping,
  storage: StorageLike = localStorage,
): void {
  const mappings = readMappings(storage);
  mappings[fingerprint] = mapping;
  try {
    storage.setItem(CSV_MAPPING_STORAGE_KEY, JSON.stringify(mappings));
  } catch {
    // Sin almacenamiento disponible el mapeo simplemente no se recuerda.
  }
}

const HEADER_HINTS = {
  date: /fecha|date/i,
  description: /desc|concepto|detalle|memo|referencia|movimiento/i,
  amount: /importe|monto|amount/i,
  income: /ingreso|abono|credit|haber|entrada/i,
  expense: /gasto|cargo|debit|debe|salida/i,
};

// Preselección a partir de los nombres de columna; el usuario puede corregirla.
export function guessMapping(headers: readonly string[], records: readonly CsvRecord[]): CsvMapping {
  const find = (pattern: RegExp, exclude: number | null = null): number | null => {
    const index = headers.findIndex((header, position) => position !== exclude && pattern.test(header));
    return index === -1 ? null : index;
  };

  const dateColumn = find(HEADER_HINTS.date) ?? 0;
  const descriptionColumn = find(HEADER_HINTS.description, dateColumn) ?? (dateColumn === 0 ? 1 : 0);
  const amountColumn = find(HEADER_HINTS.amount);
  const incomeColumn = find(HEADER_HINTS.income);
  const expenseColumn = find(HEADER_HINTS.expense);
  const split = amountColumn === null && (incomeColumn !== null || expenseColumn !== null);

  return {
    dateColumn,
    descriptionColumn,
    amountMode: split ? 'split' : 'single',
    amountColumn: split ? null : amountColumn,
    incomeColumn: split ? incomeColumn : null,
    expenseColumn: split ? expenseColumn : null,
    dateOrder: detectDateOrder(records.map((record) => record.cells[dateColumn] ?? '')),
  };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function buildImportRow(record: CsvRecord, mapping: CsvMapping): ImportRow | ImportIssue {
  const fail = (message: string): ImportIssue => ({ row: record.row, message });
  const cell = (column: number | null): string =>
    column === null ? '' : (record.cells[column] ?? '').trim();

  const dateRaw = cell(mapping.dateColumn);
  const date = parseDate(dateRaw, mapping.dateOrder);
  if (!date) {
    return fail(`Fecha no válida: "${dateRaw}"`);
  }

  const description = cell(mapping.descriptionColumn);
  if (description === '') {
    return fail('Descripción vacía');
  }
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return fail(`Descripción demasiado larga (máximo ${DESCRIPTION_MAX_LENGTH} caracteres)`);
  }

  const amount = mapping.amountMode === 'single'
    ? readSingleAmount(cell(mapping.amountColumn))
    : readSplitAmount(cell(mapping.incomeColumn), cell(mapping.expenseColumn));
  if (typeof amount === 'string') {
    return fail(amount);
  }

  return { row: record.row, date, description, amount: Math.abs(amount.signed), type: amount.type };
}

function readSingleAmount(
  raw: string,
): { signed: number; type: ImportRow['type'] } | string {
  const parsed = parseAmount(raw);
  if (parsed === null) {
    return `Importe no válido: "${raw}"`;
  }
  if (parsed === 0) {
    return 'Importe cero';
  }
  return { signed: parsed, type: parsed < 0 ? 'expense' : 'income' };
}

function readSplitAmount(
  incomeRaw: string,
  expenseRaw: string,
): { signed: number; type: ImportRow['type'] } | string {
  const income = incomeRaw === '' ? 0 : parseAmount(incomeRaw);
  const expense = expenseRaw === '' ? 0 : parseAmount(expenseRaw);
  if (income === null) {
    return `Importe de ingreso no válido: "${incomeRaw}"`;
  }
  if (expense === null) {
    return `Importe de gasto no válido: "${expenseRaw}"`;
  }
  if (income !== 0 && expense !== 0) {
    return 'Ingreso y gasto a la vez';
  }
  if (income === 0 && expense === 0) {
    return 'Sin importe de ingreso ni de gasto';
  }
  return income !== 0
    ? { signed: income, type: 'income' }
    : { signed: expense, type: 'expense' };
}

function buildLocalDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  const isSameDay =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isSameDay ? date : null;
}

function hasContent(cells: readonly string[]): boolean {
  return cells.some((cell) => cell.trim() !== '');
}

function readMappings(storage: StorageLike): Record<string, CsvMapping> {
  try {
    const raw = storage.getItem(CSV_MAPPING_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, CsvMapping>)
      : {};
  } catch {
    return {};
  }
}
