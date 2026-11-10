import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { filter } from 'rxjs';
import { conflictErrorMessage } from '../../../shared/utils/conflict-error-message';
import {
  CATEGORY_TYPE_OPTIONS,
  Category,
  CategoryTreeNode,
  CategoryType,
} from '../models/category.model';
import { CategoriesStoreService } from '../services/categories-store.service';
import {
  CategoryFormData,
  CategoryFormDialogComponent,
} from './category-form-dialog.component';

export interface CategoryFlatNode {
  category: Category;
  level: number;
  expandable: boolean;
}

@Component({
  selector: 'app-categories-tree',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categories-tree.component.html',
  styleUrl: './categories-tree.component.scss',
})
export class CategoriesTreeComponent {
  private readonly store = inject(CategoriesStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly categories = this.store.categories;
  protected readonly loading = this.store.loading;
  protected readonly error = this.store.error;
  protected readonly typeOptions = CATEGORY_TYPE_OPTIONS;

  protected readonly treeControl = new FlatTreeControl<CategoryFlatNode>(
    (node) => node.level,
    (node) => node.expandable,
  );

  private readonly treeFlattener = new MatTreeFlattener<
    CategoryTreeNode,
    CategoryFlatNode
  >(
    (node, level) => ({
      category: node,
      level,
      expandable: node.children.length > 0,
    }),
    (node) => node.level,
    (node) => node.expandable,
    (node) => node.children,
  );

  protected readonly dataSource = new MatTreeFlatDataSource(
    this.treeControl,
    this.treeFlattener,
  );

  protected readonly hasChild = (_index: number, node: CategoryFlatNode) =>
    node.expandable;

  constructor() {
    this.store.load();

    // Al recibir datos nuevos los nodos planos se recrean; se restaura la expansión guardada en el store.
    effect(() => {
      this.dataSource.data = this.store.categoriesTree();
      untracked(() => this.restoreExpansion());
    });
  }

  protected reload(): void {
    this.store.load();
  }

  protected typeLabel(type: CategoryType): string {
    return (
      CATEGORY_TYPE_OPTIONS.find((option) => option.value === type)?.label ??
      type
    );
  }

  protected toggle(node: CategoryFlatNode): void {
    const expand = !this.treeControl.isExpanded(node);
    if (expand) {
      this.treeControl.expand(node);
    } else {
      this.treeControl.collapse(node);
    }
    this.store.setExpanded(node.category.id, expand);
  }

  protected openCreate(): void {
    this.openForm(null);
  }

  protected openEdit(category: Category): void {
    this.openForm(category);
  }

  protected remove(category: Category): void {
    this.store.remove(category.id).subscribe({
      next: () =>
        this.snackBar.open('Categoría eliminada.', 'Cerrar', { duration: 4000 }),
      error: (error: unknown) =>
        this.snackBar.open(
          conflictErrorMessage(error, 'No se pudo eliminar la categoría.'),
          'Cerrar',
          { duration: 5000 },
        ),
    });
  }

  private openForm(category: Category | null): void {
    const data: CategoryFormData = { category };
    this.dialog
      .open<CategoryFormDialogComponent, CategoryFormData, Category>(
        CategoryFormDialogComponent,
        { data, width: '480px', autoFocus: 'first-tabbable' },
      )
      .afterClosed()
      .pipe(filter((saved): saved is Category => saved !== undefined))
      .subscribe(() =>
        this.snackBar.open(
          category ? 'Categoría actualizada.' : 'Categoría creada.',
          'Cerrar',
          { duration: 4000 },
        ),
      );
  }

  private restoreExpansion(): void {
    const expandedIds = this.store.expandedIds();
    for (const node of this.treeControl.dataNodes) {
      if (node.expandable && expandedIds.has(node.category.id)) {
        this.treeControl.expand(node);
      }
    }
  }
}
