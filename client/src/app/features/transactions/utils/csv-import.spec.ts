import { describe, expect, it } from 'vitest';
import {
  CsvMapping,
  buildImportRows,
  chunk,
  decodeCsvBytes,
  detectDateOrder,
  detectDelimiter,
  guessMapping,
  headerFingerprint,
  isMappingCompatible,
  loadSavedMapping,
  parseAmount,
  parseCsvText,
  parseDate,
  saveMapping,
  StorageLike,
  toTransactionRequest,
} from './csv-import';

const SINGLE_MAPPING: CsvMapping = {
  dateColumn: 0,
  descriptionColumn: 1,
  amountMode: 'single',
  amountColumn: 2,
  incomeColumn: null,
  expenseColumn: null,
  dateOrder: 'dmy',
};

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('decodeCsvBytes', () => {
  it('decodes UTF-8 and strips the BOM', () => {
    const bytes = new TextEncoder().encode('\uFEFFDescripción');
    expect(decodeCsvBytes(bytes.buffer as ArrayBuffer)).toBe('Descripción');
  });

  it('falls back to windows-1252 when the bytes are not valid UTF-8', () => {
    const bytes = new Uint8Array([0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0x70, 0x63, 0x69, 0xf3, 0x6e]);
    expect(decodeCsvBytes(bytes.buffer)).toBe('Descripción');
  });
});

describe('detectDelimiter', () => {
  it('detects semicolon, comma and tab separators', () => {
    expect(detectDelimiter('fecha;descripcion;importe\n01/02/2024;Super;-12,50')).toBe(';');
    expect(detectDelimiter('date,description,amount\n2024-02-01,Shop,-12.50')).toBe(',');
    expect(detectDelimiter('date\tdescription\n2024-02-01\tShop')).toBe('\t');
  });
});

describe('parseCsvText', () => {
  it('uses the first non-empty record as header and keeps file row numbers', () => {
    const parsed = parseCsvText('\nfecha,desc,importe\n\n2024-01-01,Café,-3.00\n', ',');

    expect(parsed.headers).toEqual(['fecha', 'desc', 'importe']);
    expect(parsed.records).toEqual([{ row: 4, cells: ['2024-01-01', 'Café', '-3.00'] }]);
  });
});

describe('parseDate', () => {
  it('accepts ISO dates', () => {
    expect(parseDate('2024-03-09', 'dmy')).toEqual(new Date(2024, 2, 9));
    expect(parseDate('2024-03-09T10:00:00Z', 'mdy')).toEqual(new Date(2024, 2, 9));
  });

  it('reads slash dates in the detected order', () => {
    expect(parseDate('09/03/2024', 'dmy')).toEqual(new Date(2024, 2, 9));
    expect(parseDate('03/09/2024', 'mdy')).toEqual(new Date(2024, 2, 9));
  });

  it('rejects impossible or malformed dates', () => {
    expect(parseDate('31/02/2024', 'dmy')).toBeNull();
    expect(parseDate('hoy', 'dmy')).toBeNull();
  });
});

describe('detectDateOrder', () => {
  it('detects day-first when a value has a first part above 12', () => {
    expect(detectDateOrder(['25/01/2024', '03/02/2024'])).toBe('dmy');
  });

  it('detects month-first when a value has a second part above 12', () => {
    expect(detectDateOrder(['01/25/2024', '02/03/2024'])).toBe('mdy');
  });

  it('defaults to day-first when every date is ambiguous', () => {
    expect(detectDateOrder(['03/04/2024'])).toBe('dmy');
  });
});

describe('parseAmount', () => {
  it.each([
    ['12.50', 1250],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1,234', 123400],
    ['-12,50 €', -1250],
    ['(12.50)', -1250],
    ['1.234.567', 123456700],
  ])('parses %s', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it('returns null for text without digits', () => {
    expect(parseAmount('n/a')).toBeNull();
  });
});

describe('buildImportRows', () => {
  it('maps signed amounts to income or expense and reports rows with reasons', () => {
    const parsed = parseCsvText(
      [
        'fecha,desc,importe',
        '2024-01-05,Nómina,1500.00',
        '05/01/2024,Super,-42.10',
        '32/01/2024,Mal,10',
        '2024-01-06,,5',
        '2024-01-07,Cero,0',
      ].join('\n'),
      ',',
    );

    const result = buildImportRows(parsed.records, SINGLE_MAPPING);

    expect(result.rows.map((row) => [row.row, row.type, row.amount])).toEqual([
      [2, 'income', 150000],
      [3, 'expense', 4210],
    ]);
    expect(result.issues).toEqual([
      { row: 4, message: 'Fecha no válida: "32/01/2024"' },
      { row: 5, message: 'Descripción vacía' },
      { row: 6, message: 'Importe cero' },
    ]);
  });

  it('supports separate income and expense columns', () => {
    const mapping: CsvMapping = {
      ...SINGLE_MAPPING,
      amountMode: 'split',
      amountColumn: null,
      incomeColumn: 2,
      expenseColumn: 3,
    };
    const parsed = parseCsvText(
      ['fecha,desc,ingreso,gasto', '2024-01-05,Nómina,900,', '2024-01-06,Pan,,2.30', '2024-01-07,Vacío,,'].join('\n'),
      ',',
    );

    const result = buildImportRows(parsed.records, mapping);

    expect(result.rows.map((row) => [row.type, row.amount])).toEqual([
      ['income', 90000],
      ['expense', 230],
    ]);
    expect(result.issues).toEqual([{ row: 4, message: 'Sin importe de ingreso ni de gasto' }]);
  });
});

describe('toTransactionRequest', () => {
  it('builds a request with the default account and category', () => {
    const [row] = buildImportRows(
      parseCsvText('fecha,desc,importe\n2024-01-05,Super,-12.50', ',').records,
      SINGLE_MAPPING,
    ).rows;

    expect(toTransactionRequest(row, 'acc-1', 'cat-1')).toEqual({
      type: 'expense',
      amount: 1250,
      date: expect.any(String),
      description: 'Super',
      accountId: 'acc-1',
      targetAccountId: null,
      categoryId: 'cat-1',
      tagIds: [],
      notes: null,
    });
  });
});

describe('headerFingerprint', () => {
  it('ignores case and surrounding spaces', () => {
    expect(headerFingerprint(['Fecha', ' Importe '])).toBe(headerFingerprint(['fecha', 'importe']));
  });

  it('differs when the columns differ', () => {
    expect(headerFingerprint(['fecha', 'importe'])).not.toBe(headerFingerprint(['fecha', 'monto']));
  });
});

describe('saved mappings', () => {
  it('reuses a mapping saved for the same fingerprint', () => {
    const storage = memoryStorage();
    const fingerprint = headerFingerprint(['fecha', 'desc', 'importe']);

    saveMapping(fingerprint, SINGLE_MAPPING, storage);

    expect(loadSavedMapping(fingerprint, storage)).toEqual(SINGLE_MAPPING);
    expect(loadSavedMapping('other', storage)).toBeNull();
  });

  it('ignores corrupted storage content', () => {
    const storage = memoryStorage();
    storage.setItem('csv-import.mappings', '{no json');

    expect(loadSavedMapping('any', storage)).toBeNull();
  });

  it('rejects mappings that point at missing columns', () => {
    expect(isMappingCompatible(SINGLE_MAPPING, 3)).toBe(true);
    expect(isMappingCompatible(SINGLE_MAPPING, 2)).toBe(false);
  });
});

describe('guessMapping', () => {
  it('preselects columns from header names and detects the date order', () => {
    const parsed = parseCsvText(
      ['Fecha;Concepto;Ingreso;Gasto', '25/01/2024;Nómina;900;', '03/02/2024;Pan;;2,30'].join('\n'),
      ';',
    );

    expect(guessMapping(parsed.headers, parsed.records)).toEqual({
      dateColumn: 0,
      descriptionColumn: 1,
      amountMode: 'split',
      amountColumn: null,
      incomeColumn: 2,
      expenseColumn: 3,
      dateOrder: 'dmy',
    });
  });

  it('uses a single signed amount column when one exists', () => {
    const parsed = parseCsvText('date,description,amount\n2024-01-05,Shop,-3', ',');

    expect(guessMapping(parsed.headers, parsed.records)).toMatchObject({
      amountMode: 'single',
      amountColumn: 2,
      incomeColumn: null,
      expenseColumn: null,
    });
  });
});

describe('chunk', () => {
  it('splits items into groups of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
