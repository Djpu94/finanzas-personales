import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-error-state',
  templateUrl: './error-state.component.html',
  styleUrl: './error-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ErrorStateComponent {
  readonly message = input('No se pudo cargar la información.');
  readonly loading = input(false, { transform: booleanAttribute });

  readonly retry = output<void>();
}
