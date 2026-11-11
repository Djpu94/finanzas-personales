import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { concatMap, from, map } from 'rxjs';
import { AccountsStoreService } from '../../accounts/services/accounts-store.service';
import { CategoriesStoreService } from '../../categories/services/categories-store.service';
import {
  AmountMode,
  CSV_BULK_CHUNK_SIZE,
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  CsvMapping,
  DateOrder,
  ImportIssue,
  ImportRow,
  ParsedCsv,
  buildImportRows,
  chunk,
  decodeCsvBytes,
  detectDelimiter,
  guessMapping,
  headerFingerprint,
  isMappingCompatible,
  loadSavedMapping,
  parseCsvText,
  saveMapping,
  toTransactionRequest,
} from '../utils/csv-import';
import { TransactionsStoreService } from '../services/transactions-store.service';

const PREVIEW_ROWS = 5;

interface MappingFormValue {
  dateColumn: number | null;
  descriptionColumn: number | null;
  amountMode: AmountMode;
  amountColumn: number | null;
  incomeColumn: number | null;
  expenseColumn: number | null;
  dateOrder: DateOrder;
  remember: boolean;
}

interface ImportFailure {
  row: number;
  message: string;
}

interface ImportSummary {
  inserted: number;
  failures: ImportFailure[];
}

function readMapping(value: MappingFormValue): CsvMapping | null {
  const { dateColumn, descriptionColumn, dateOrder } = value;
  if (dateColumn === null || descriptionColumn === null) {
    return null;
  }
  if (value.amountMode === 'single') {
    return value.amountColumn === null
      ? null
      : {
          dateColumn,
          descriptionColumn,
          dateOrder,
          amountMode: 'single',
          amountColumn: value.amountColumn,
          incomeColumn: null,
          expenseColumn: null,
        };
  }
  if (value.incomeColumn === null && value.expenseColumn === null) {
    return null;
  }
  return {
    dateColumn,
    descriptionColumn,
    dateOrder,
    amountMode: 'split',
    amountColumn: null,
    incomeColumn: value.incomeColumn,
    expenseColumn: value.expenseColumn,
  };
}

@Component({
  selector: 'app-csv-import-wizard',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './csv-import-wizard.component.html',
  styleUrl: './csv-import-wizard.component.scss',
})
export class CsvImportWizardComponent {
  private readonly dialogRef =
    inject<MatDialogRef<CsvImportWizardComponent, number>>(MatDialogRef);
  private readonly transactionsStore = inject(TransactionsStoreService);
  private readonly accountsStore = inject(AccountsStoreService);
  private readonly categoriesStore = inject(CategoriesStoreService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxRows = CSV_MAX_ROWS;
  protected readonly dateOrderOptions: readonly {
    value: DateOrder;
    label: string;
  }[] = [
    { value: 'dmy', label: 'Día / Mes / Año' },
    { value: 'mdy', label: 'Mes / Día / Año' },
  ];

  protected readonly parsed = signal<ParsedCsv | null>(null);
  protected readonly fileName = signal('');
  protected readonly uploadError = signal<string | null>(null);
  protected readonly mappingNotice = signal<string | null>(null);
  protected readonly dragging = signal(false);

  protected readonly importing = signal(false);
  protected readonly importTotal = signal(0);
  protected readonly progress = signal(0);
  protected readonly fatalError = signal<string | null>(null);
  protected readonly summary = signal<ImportSummary | null>(null);

  protected readonly mappingForm = this.fb.group({
    dateColumn: this.fb.control<number | null>(null),
    descriptionColumn: this.fb.control<number | null>(null),
    amountMode: this.fb.control<AmountMode>('single'),
    amountColumn: this.fb.control<number | null>(null),
    incomeColumn: this.fb.control<number | null>(null),
    expenseColumn: this.fb.control<number | null>(null),
    dateOrder: this.fb.control<DateOrder>('dmy'),
    remember: this.fb.control(true),
  });

  protected readonly destinationForm = this.fb.group({
    accountId: this.fb.control<string | null>(null),
    categoryId: this.fb.control<string | null>(null),
  });

  private readonly mappingValue = toSignal(
    this.mappingForm.valueChanges.pipe(
      map(() => this.mappingForm.getRawValue()),
    ),
    { initialValue: this.mappingForm.getRawValue() },
  );
  private readonly destinationValue = toSignal(
    this.destinationForm.valueChanges.pipe(
      map(() => this.destinationForm.getRawValue()),
    ),
    { initialValue: this.destinationForm.getRawValue() },
  );

  protected readonly accounts = computed(() =>
    this.accountsStore.accounts().filter((account) => !account.isArchived),
  );
  protected readonly categoryOptions = this.categoriesStore.indentedCategories;

  protected readonly columnOptions = computed(() =>
    (this.parsed()?.headers ?? []).map((header, index) => ({
      index,
      label: header || `Columna ${index + 1}`,
    })),
  );

  protected readonly mapping = computed(() => readMapping(this.mappingValue()));

  protected readonly preview = computed(() => {
    const parsed = this.parsed();
    const mapping = this.mapping();
    if (!parsed || !mapping) {
      return [];
    }
    return parsed.records.slice(0, PREVIEW_ROWS).map((record) => {
      const result = buildImportRows([record], mapping);
      return {
        row: record.row,
        importRow: result.rows[0] ?? null,
        issue: result.issues[0]?.message ?? null,
      };
    });
  });

  protected readonly review = computed<{
    rows: ImportRow[];
    issues: ImportIssue[];
  }>(() => {
    const parsed = this.parsed();
    const mapping = this.mapping();
    return parsed && mapping
      ? buildImportRows(parsed.records, mapping)
      : { rows: [], issues: [] };
  });

  protected readonly progressPercent = computed(() => {
    const total = this.importTotal();
    return total === 0 ? 0 : Math.round((this.progress() / total) * 100);
  });

  protected readonly canImport = computed(
    () =>
      !this.importing() &&
      this.summary() === null &&
      this.destinationValue().accountId !== null &&
      this.review().rows.length > 0,
  );

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDragLeave(): void {
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files.item(0);
    if (file) {
      void this.loadFile(file);
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (file) {
      void this.loadFile(file);
    }
    input.value = '';
  }

  protected rememberMapping(): void {
    const parsed = this.parsed();
    const mapping = this.mapping();
    if (parsed && mapping && this.mappingForm.controls.remember.value) {
      saveMapping(headerFingerprint(parsed.headers), mapping);
    }
  }

  protected startImport(): void {
    const accountId = this.destinationValue().accountId;
    const categoryId = this.destinationValue().categoryId;
    const { rows, issues } = this.review();
    if (!this.canImport() || accountId === null) {
      return;
    }

    let inserted = 0;
    let processed = 0;
    const failures: ImportFailure[] = issues.map((issue) => ({
      row: issue.row,
      message: issue.message,
    }));

    this.importing.set(true);
    this.importTotal.set(rows.length);
    this.progress.set(0);
    this.fatalError.set(null);
    this.dialogRef.disableClose = true;

    from(chunk(rows, CSV_BULK_CHUNK_SIZE))
      .pipe(
        concatMap((group) =>
          this.transactionsStore
            .createBulk(
              group.map((row) =>
                toTransactionRequest(row, accountId, categoryId),
              ),
            )
            .pipe(map((response) => ({ group, response }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ group, response }) => {
          inserted += response.inserted;
          for (const error of response.errors) {
            failures.push({
              row: group[error.index]?.row ?? 0,
              message: error.message,
            });
          }
          processed += group.length;
          this.progress.set(processed);
        },
        error: () => {
          this.fatalError.set(
            `La importación se interrumpió por un error de conexión. Se importaron ${inserted} transacciones; no reintentes sin revisar el extracto para evitar duplicados.`,
          );
          this.finishImport(inserted, failures);
        },
        complete: () => this.finishImport(inserted, failures),
      });
  }

  protected close(): void {
    this.dialogRef.close(this.summary()?.inserted ?? 0);
  }

  private finishImport(inserted: number, failures: ImportFailure[]): void {
    this.importing.set(false);
    this.dialogRef.disableClose = false;
    this.summary.set({
      inserted,
      failures: failures.sort((a, b) => a.row - b.row),
    });
    if (inserted > 0) {
      this.transactionsStore.reload();
    }
  }

  private async loadFile(file: File): Promise<void> {
    this.uploadError.set(null);
    this.mappingNotice.set(null);

    if (!/\.csv$/i.test(file.name)) {
      this.failUpload('Solo se admiten archivos .csv por ahora.');
      return;
    }
    if (file.size > CSV_MAX_BYTES) {
      this.failUpload('El archivo supera el tamaño máximo de 5 MB.');
      return;
    }

    const text = decodeCsvBytes(await file.arrayBuffer());
    const parsed = parseCsvText(text, detectDelimiter(text));
    if (parsed.headers.length < 2) {
      this.failUpload(
        'No se detectaron columnas. Revisa que el archivo use un separador válido.',
      );
      return;
    }
    if (parsed.records.length === 0) {
      this.failUpload('El archivo no contiene filas de transacciones.');
      return;
    }
    if (parsed.records.length > CSV_MAX_ROWS) {
      this.failUpload(`El archivo tiene más de ${CSV_MAX_ROWS} filas.`);
      return;
    }

    this.fileName.set(file.name);
    this.parsed.set(parsed);
    this.summary.set(null);
    this.applyInitialMapping(parsed);
  }

  private failUpload(message: string): void {
    this.parsed.set(null);
    this.fileName.set('');
    this.uploadError.set(message);
  }

  private applyInitialMapping(parsed: ParsedCsv): void {
    const saved = loadSavedMapping(headerFingerprint(parsed.headers));
    if (saved && isMappingCompatible(saved, parsed.headers.length)) {
      this.mappingForm.patchValue(saved);
      this.mappingNotice.set(
        'Se reutilizó el mapeo guardado para estas columnas.',
      );
      return;
    }
    this.mappingForm.patchValue(guessMapping(parsed.headers, parsed.records));
  }
}
