import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTreeModule } from '@angular/material/tree';
import { CategoriesPageComponent } from './components/categories-page.component';
import { CategoriesTreeComponent } from './components/categories-tree.component';
import { CategoryFormDialogComponent } from './components/category-form-dialog.component';
import { TagsListComponent } from './components/tags-list.component';

const routes: Routes = [{ path: '', component: CategoriesPageComponent }];

@NgModule({
  declarations: [
    CategoriesPageComponent,
    CategoriesTreeComponent,
    CategoryFormDialogComponent,
    TagsListComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTabsModule,
    MatTreeModule,
  ],
})
export class CategoriesModule {}
