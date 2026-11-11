import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-zen-layout',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zen-layout.component.html',
  styleUrl: './zen-layout.component.scss',
})
export class ZenLayoutComponent {}
