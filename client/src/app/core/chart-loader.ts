import type { Chart as ChartType } from 'chart.js';

let chartModule: Promise<typeof import('chart.js')> | null = null;

// Carga Chart.js bajo demanda para que no forme parte del bundle inicial.
export function loadChartJs(): Promise<{ Chart: typeof ChartType }> {
  chartModule ??= import('chart.js').then((module) => {
    module.Chart.register(...module.registerables);
    return module;
  });
  return chartModule;
}
