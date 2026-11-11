import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

export type EmptyStateSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly ctaLabel = input<string | null>(null);
  readonly ctaLink = input<string | null>(null);
  readonly size = input<EmptyStateSize>('md');

  readonly cta = output<void>();
}
