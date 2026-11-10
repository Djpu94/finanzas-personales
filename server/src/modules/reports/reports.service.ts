import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { stringify } from 'csv-stringify';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PassThrough, Readable, pipeline } from 'node:stream';
import type * as PdfMake from 'pdfmake';
import { Model, Types } from 'mongoose';
import { Account } from '../accounts/account.schema.js';
import { Category } from '../categories/category.schema.js';
import { Tag } from '../categories/tag.schema.js';
import { parseMonthKey } from '../analytics/analytics-periods.js';
import {
  buildTransactionFilter,
  type TransactionFilters,
} from '../transactions/transaction-rules.js';
import { Transaction } from '../transactions/transaction.schema.js';
import { buildMonthlyReportDocument } from './report-pdf.js';
import {
  REPORT_CSV_COLUMNS,
  UTF8_BOM,
  monthTitle,
  summarizeMonth,
  toNameMap,
  toReportRow,
  type ReportNames,
  type ReportRow,
  type ReportTransactionSource,
} from './report-rules.js';

// pdfmake 0.3 es CommonJS sin exports con nombre, así que se carga con require.
const requireCjs = createRequire(import.meta.url);
const pdfmake = requireCjs('pdfmake') as typeof PdfMake;
const ROBOTO_DIR = path.join(
  path.dirname(requireCjs.resolve('pdfmake/package.json')),
  'fonts',
  'Roboto',
);
pdfmake.addFonts({
  Roboto: {
    normal: path.join(ROBOTO_DIR, 'Roboto-Regular.ttf'),
    bold: path.join(ROBOTO_DIR, 'Roboto-Medium.ttf'),
    italics: path.join(ROBOTO_DIR, 'Roboto-Italic.ttf'),
    bolditalics: path.join(ROBOTO_DIR, 'Roboto-MediumItalic.ttf'),
  },
});

interface NamedDocument {
  _id: Types.ObjectId;
  name: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    @InjectModel(Account.name) private readonly accountModel: Model<Account>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
    @InjectModel(Tag.name) private readonly tagModel: Model<Tag>,
  ) {}

  // El CSV se emite fila a fila desde un cursor para no cargar el mes entero.
  streamMonthlyCsv(userId: string, period: string): Readable {
    const output = new PassThrough();
    output.write(UTF8_BOM);

    pipeline(
      Readable.from(this.csvRows(userId, period)),
      stringify({ header: true, columns: [...REPORT_CSV_COLUMNS] }),
      output,
      (error) => {
        if (error) {
          this.logger.error(`Fallo al exportar el CSV del periodo ${period}`, error.stack);
          output.destroy(error);
        }
      },
    );

    return output;
  }

  async buildMonthlyPdf(userId: string, period: string): Promise<Buffer> {
    const [transactions, names] = await Promise.all([
      this.findMonthTransactions(userId, period).exec(),
      this.loadNames(userId),
    ]);

    const rows = transactions.map((transaction) => toReportRow(transaction, names));
    const document = buildMonthlyReportDocument({
      title: monthTitle(period),
      summary: summarizeMonth(transactions),
      rows,
    });

    return pdfmake.createPdf(document).getBuffer();
  }

  private async *csvRows(userId: string, period: string): AsyncGenerator<ReportRow> {
    const names = await this.loadNames(userId);
    const cursor = this.findMonthTransactions(userId, period).cursor();

    for await (const transaction of cursor) {
      yield toReportRow(transaction, names);
    }
  }

  private findMonthTransactions(userId: string, period: string) {
    const { start, endExclusive } = parseMonthKey(period);
    const filters: TransactionFilters = {
      from: start,
      to: new Date(endExclusive.getTime() - 1),
    };

    return this.transactionModel
      .find(buildTransactionFilter(userId, filters))
      .sort({ date: 1, _id: 1 })
      .lean<ReportTransactionSource[]>();
  }

  private async loadNames(userId: string): Promise<ReportNames> {
    const [accounts, categories, tags] = await Promise.all([
      this.accountModel.find({ userId }, { name: 1 }).lean<NamedDocument[]>().exec(),
      this.categoryModel.find({ userId }, { name: 1 }).lean<NamedDocument[]>().exec(),
      this.tagModel.find({ userId }, { name: 1 }).lean<NamedDocument[]>().exec(),
    ]);

    return {
      accounts: toNameMap(accounts),
      categories: toNameMap(categories),
      tags: toNameMap(tags),
    };
  }
}
