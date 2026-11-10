import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SharedModule } from '../../shared/shared-module';
import { DashboardComponent } from './components/dashboard.component';
import { CashFlowChartComponent } from './components/cash-flow-chart.component';
import { CategoryDonutComponent } from './components/category-donut.component';
import { RecentTransactionsComponent } from './components/recent-transactions.component';
import { VerdictRowComponent } from './components/verdict-row.component';

const routes: Routes = [{ path: '', component: DashboardComponent }];

@NgModule({
  declarations: [
    DashboardComponent,
    CashFlowChartComponent,
    CategoryDonutComponent,
    RecentTransactionsComponent,
    VerdictRowComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    SharedModule,
  ],
})
export class DashboardModule {}
