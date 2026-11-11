import {
  ElementRef,
  OnDestroy,
  Directive,
  effect,
  inject,
  input,
} from '@angular/core';
import type { Chart, ChartConfiguration } from 'chart.js';
import { loadChartJs } from '../../core/chart-loader';

// Crea el chart a partir de la configuración y lo destruye al cambiar o al salir.
@Directive({
  selector: 'canvas[appChartContainer]',
  standalone: false,
})
export class ChartContainerDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLCanvasElement>>(ElementRef);
  private chart: Chart | null = null;
  private renderVersion = 0;

  readonly appChartContainer = input<ChartConfiguration | null>(null);

  constructor() {
    effect(() => {
      void this.render(this.appChartContainer());
    });
  }

  ngOnDestroy(): void {
    this.renderVersion++;
    this.destroyChart();
  }

  private async render(config: ChartConfiguration | null): Promise<void> {
    const version = ++this.renderVersion;
    this.destroyChart();
    if (!config) {
      return;
    }
    const { Chart: ChartClass } = await loadChartJs();
    // Si mientras se cargaba cambió la config o se destruyó la vista, no se crea el chart.
    if (version !== this.renderVersion) {
      return;
    }
    this.chart = new ChartClass(this.host.nativeElement, config);
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}
