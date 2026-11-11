import type { Chart as ChartType } from 'chart.js';

export interface ChartTheme {
  color?: string;
  borderColor?: string;
  reducedMotion?: boolean;
}

type ChartModule = typeof import('chart.js');

let chartModule: Promise<ChartModule> | null = null;
let loadedModule: ChartModule | null = null;
let chartTheme: ChartTheme = {};

// Los colores se guardan aquí y se aplican al cargar Chart.js: el tema no fuerza la descarga.
export function setChartTheme(theme: ChartTheme): void {
  chartTheme = { ...chartTheme, ...theme };
  if (loadedModule) {
    applyChartTheme(loadedModule.Chart);
  }
}

// Carga Chart.js bajo demanda para que no forme parte del bundle inicial.
export function loadChartJs(): Promise<{ Chart: typeof ChartType }> {
  chartModule ??= import('chart.js').then((module) => {
    module.Chart.register(...module.registerables);
    loadedModule = module;
    applyChartTheme(module.Chart);
    return module;
  });
  return chartModule;
}

function applyChartTheme(Chart: typeof ChartType): void {
  if (chartTheme.color) {
    Chart.defaults.color = chartTheme.color;
  }
  if (chartTheme.borderColor) {
    Chart.defaults.borderColor = chartTheme.borderColor;
  }
  // Solo se desactiva la animación; sin preferencia explícita se mantiene la de Chart.js.
  if (chartTheme.reducedMotion) {
    Chart.defaults.animation = false;
  }
}
