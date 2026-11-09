import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

@Component({
  selector: 'app-placeholder-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './placeholder-page.component.html',
})
export class PlaceholderPageComponent {
  protected readonly title = toSignal(
    inject(ActivatedRoute).data.pipe(
      map((data) => String(data['title'] ?? '')),
    ),
    { initialValue: '' },
  );
}
