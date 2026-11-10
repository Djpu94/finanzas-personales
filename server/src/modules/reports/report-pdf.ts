import type * as PdfMake from 'pdfmake';
import type { MonthlySummary, ReportRow } from './report-rules.js';

type Content = PdfMake.Content;
type TDocumentDefinitions = Parameters<typeof PdfMake.createPdf>[0];

const BAR_MAX_WIDTH = 300;
const INCOME_COLOR = '#2e7d32';
const EXPENSE_COLOR = '#c62828';
const AMOUNT_SIGN = { income: '+', expense: '-', transfer: '' } as const;

export interface MonthlyReportInput {
  title: string;
  summary: MonthlySummary;
  rows: ReportRow[];
}

// Entrada en unidades (no centavos).
function formatMoney(units: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(units);
}

function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

function summaryTable(summary: MonthlySummary): Content {
  const line = (label: string, cents: number): [Content, Content] => [
    { text: label },
    { text: formatMoney(cents / 100), alignment: 'right' },
  ];

  return {
    table: {
      widths: ['*', 120],
      body: [
        line('Ingresos', summary.income),
        line('Gastos', summary.expense),
        [
          { text: 'Balance', bold: true },
          { text: formatMoney(summary.balance / 100), alignment: 'right', bold: true },
        ],
      ],
    },
    layout: 'lightHorizontalLines',
  };
}

// Barras proporcionales de ingresos frente a gastos, dibujadas como vectores.
function balanceChart(summary: MonthlySummary): Content {
  const max = Math.max(summary.income, summary.expense, 1);
  const bar = (label: string, cents: number, color: string): Content => ({
    columns: [
      { width: 70, text: label },
      {
        width: BAR_MAX_WIDTH,
        canvas: [
          {
            type: 'rect',
            x: 0,
            y: 0,
            w: (cents / max) * BAR_MAX_WIDTH,
            h: 14,
            r: 2,
            color,
          },
        ],
      },
      { width: 'auto', text: formatMoney(cents / 100), margin: [8, 0, 0, 0] },
    ],
    margin: [0, 2, 0, 2],
  });

  return {
    stack: [
      bar('Ingresos', summary.income, INCOME_COLOR),
      bar('Gastos', summary.expense, EXPENSE_COLOR),
    ],
  };
}

function transactionsTable(rows: ReportRow[]): Content {
  if (rows.length === 0) {
    return { text: 'No hay transacciones en este mes.', italics: true };
  }

  const header = ['Fecha', 'Descripción', 'Cuenta', 'Categoría', 'Importe'].map(
    (text) => ({ text, style: 'tableHeader' }),
  );
  const body = rows.map((row) => [
    formatDate(row.date),
    row.description,
    row.account,
    row.category,
    {
      text: `${AMOUNT_SIGN[row.type]}${formatMoney(Number(row.amount))}`,
      alignment: 'right' as const,
    },
  ]);

  return {
    table: {
      headerRows: 1,
      widths: [56, '*', 90, 80, 70],
      body: [header, ...body],
    },
    layout: 'lightHorizontalLines',
  };
}

export function buildMonthlyReportDocument(
  input: MonthlyReportInput,
): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [40, 56, 40, 56],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    styles: {
      title: { fontSize: 18, bold: true, margin: [0, 0, 0, 12] },
      sectionTitle: { fontSize: 12, bold: true, margin: [0, 16, 0, 6] },
      tableHeader: { bold: true, fillColor: '#eeeeee' },
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: 'right',
      fontSize: 8,
      margin: [40, 0, 40, 0],
    }),
    content: [
      { text: input.title, style: 'title' },
      { text: 'Resumen', style: 'sectionTitle' },
      summaryTable(input.summary),
      balanceChart(input.summary),
      { text: 'Transacciones', style: 'sectionTitle' },
      transactionsTable(input.rows),
    ],
  };
}
