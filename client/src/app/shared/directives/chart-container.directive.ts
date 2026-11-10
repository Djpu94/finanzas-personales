import {
  ElementRef,
  OnDestroy,
  Directive,
  effect,
  inject,
  input,
} from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

// Crea el chart a partir de la configuración y lo destruye al cambiar o al salir.
@Directive({
  selector: 'canvas[appChartContainer]',
  standalone: false,
})
export class ChartContainerDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLCanvasElement>>(ElementRef);
  private chart: Chart | null = null;

  readonly appChartContainer = input<ChartConfiguration | null>(null);

  constructor() {
    effect(() => this.render(this.appChartContainer()));
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private render(config: ChartConfiguration | null): void {
    this.destroyChart();
    if (config) {
      this.chart = new Chart(this.host.nativeElement, config);
    }
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}
