import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from '../../shared/shared-module';
import { ZenLayoutComponent } from './components/zen-layout.component';
import { ZenPageComponent } from './components/zen-page.component';

const routes: Routes = [
  {
    path: '',
    component: ZenLayoutComponent,
    children: [{ path: '', component: ZenPageComponent }],
  },
];

@NgModule({
  declarations: [ZenLayoutComponent, ZenPageComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    MatButtonModule,
    MatIconModule,
    SharedModule,
  ],
})
export class ZenModule {}
