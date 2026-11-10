import { createRequire } from 'node:module';
import path from 'node:path';
import type * as PdfMake from 'pdfmake';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildMonthlyReportDocument } from './report-pdf.js';
import type { ReportRow } from './report-rules.js';

const requireCjs = createRequire(import.meta.url);
const pdfmake = requireCjs('pdfmake') as typeof PdfMake;
const robotoDir = path.join(
  path.dirname(requireCjs.resolve('pdfmake/package.json')),
  'fonts',
  'Roboto',
);

const rows: ReportRow[] = [
  {
    date: '2024-03-02',
    type: 'income',
    description: 'Nómina',
    amount: '1000.00',
    account: 'Banco',
    category: 'Salario',
    tags: '',
  },
  {
    date: '2024-03-10',
    type: 'expense',
    description: 'Supermercado',
    amount: '155.50',
    account: 'Banco',
    category: 'Comida',
    tags: 'viaje',
  },
];

describe('buildMonthlyReportDocument', () => {
  beforeAll(() => {
    pdfmake.addFonts({
      Roboto: {
        normal: path.join(robotoDir, 'Roboto-Regular.ttf'),
        bold: path.join(robotoDir, 'Roboto-Medium.ttf'),
        italics: path.join(robotoDir, 'Roboto-Italic.ttf'),
        bolditalics: path.join(robotoDir, 'Roboto-MediumItalic.ttf'),
      },
    });
  });

  it('pone el título y el resumen antes de la tabla de transacciones', () => {
    const doc = buildMonthlyReportDocument({
      title: 'Reporte marzo de 2024',
      summary: { income: 100000, expense: 15550, balance: 84450 },
      rows,
    });

    const content = doc.content as unknown[];
    expect(JSON.stringify(content[0])).toContain('Reporte marzo de 2024');
    expect(JSON.stringify(content.slice(0, 3))).toContain('844,50');
  });

  it('genera un PDF válido', async () => {
    const doc = buildMonthlyReportDocument({
      title: 'Reporte marzo de 2024',
      summary: { income: 100000, expense: 15550, balance: 84450 },
      rows,
    });

    const buffer = await pdfmake.createPdf(doc).getBuffer();
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('genera un PDF válido sin transacciones', async () => {
    const doc = buildMonthlyReportDocument({
      title: 'Reporte abril de 2024',
      summary: { income: 0, expense: 0, balance: 0 },
      rows: [],
    });

    const buffer = await pdfmake.createPdf(doc).getBuffer();
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });
});
