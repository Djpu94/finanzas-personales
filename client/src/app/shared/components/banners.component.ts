import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConnectivityService } from '../../core/connectivity.service';
import { InstallPromptService } from '../../core/install-prompt.service';

@Component({
  selector: 'app-banners',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './banners.component.scss',
  templateUrl: './banners.component.html',
})
export class BannersComponent {
  protected readonly connectivity = inject(ConnectivityService);
  protected readonly install = inject(InstallPromptService);
}
