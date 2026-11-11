import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type LoadingSkeletonVariant = 'card' | 'list' | 'chart' | 'summary';

@Component({
  selector: 'app-loading-skeleton',
  templateUrl: './loading-skeleton.component.html',
  styleUrl: './loading-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LoadingSkeletonComponent {
  readonly variant = input<LoadingSkeletonVariant>('list');
  readonly rows = input(3);
  readonly label = input('Cargando contenido');

  protected readonly items = computed(() =>
    Array.from({ length: Math.max(1, this.rows()) }, (_, index) => index),
  );
}
