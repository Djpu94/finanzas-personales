import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ApiService } from './core/api.service';

@Component({
  selector: 'app-root',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly healthStatus = signal('cargando...');

  ngOnInit(): void {
    this.api.getHealth().subscribe({
      next: (response) => this.healthStatus.set(response.status),
      error: () => this.healthStatus.set('error de conexión'),
    });
  }
}
