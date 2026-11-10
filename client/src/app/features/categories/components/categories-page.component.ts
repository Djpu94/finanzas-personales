import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-categories-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categories-page.component.html',
  styleUrl: './categories-page.component.scss',
})
export class CategoriesPageComponent {}
