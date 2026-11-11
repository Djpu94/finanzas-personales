import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OfflinePageComponent } from '../../shared/components/offline-page.component';
import { SharedModule } from '../../shared/shared-module';

const routes: Routes = [{ path: '', component: OfflinePageComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes), SharedModule],
})
export class OfflineModule {}
