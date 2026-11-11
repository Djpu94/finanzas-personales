import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { downloadBlob } from '../utils/download-blob';

export type ReportFormat = 'csv' | 'pdf';

@Component({
  selector: 'app-report-export-menu',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-export-menu.component.html',
})
export class ReportExportMenuComponent {
  readonly period = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly exporting = signal<ReportFormat | null>(null);

  protected download(format: ReportFormat): void {
    const period = this.period();
    this.exporting.set(format);
    this.api
      .getBlob('/reports/monthly', { period, format }, { silentErrors: true })
      .pipe(finalize(() => this.exporting.set(null)))
      .subscribe({
        next: (blob) => downloadBlob(blob, `reporte-${period}.${format}`),
        error: () =>
          this.snackBar.open('No se pudo generar el reporte.', 'Cerrar', {
            duration: 4000,
          }),
      });
  }
}
