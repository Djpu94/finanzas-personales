import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import {
  Category,
  CategoryTreeNode,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../models/category.model';
import {
  IndentedCategory,
  buildCategoryTree,
  collectSubtreeIds,
  listCategoriesInTreeOrder,
} from '../utils/category-tree';

// Vive en root para que el estado de expansión sobreviva a la navegación.
@Injectable({ providedIn: 'root' })
export class CategoriesStoreService {
  private readonly api = inject(ApiService);
  private readonly categoriesState = signal<Category[]>([]);
  private readonly expandedIdsState = signal<ReadonlySet<string>>(new Set());

  readonly categories = this.categoriesState.asReadonly();
  readonly categoriesTree = computed<CategoryTreeNode[]>(() =>
    buildCategoryTree(this.categoriesState()),
  );
  readonly indentedCategories = computed<IndentedCategory[]>(() =>
    listCategoriesInTreeOrder(this.categoriesState()),
  );
  readonly expandedIds = this.expandedIdsState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .get<Category[]>('/categories', { format: 'flat' })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (categories) => this.categoriesState.set(categories),
        error: () => this.error.set('No se pudieron cargar las categorías.'),
      });
  }

  create(request: CreateCategoryRequest): Observable<Category> {
    return this.api
      .post<Category>('/categories', request, { silentErrors: true })
      .pipe(
        tap((category) =>
          this.categoriesState.update((categories) => [
            ...categories,
            category,
          ]),
        ),
      );
  }

  update(id: string, request: UpdateCategoryRequest): Observable<Category> {
    return this.api
      .patch<Category>(`/categories/${id}`, request, { silentErrors: true })
      .pipe(
        tap((updated) =>
          this.categoriesState.update((categories) =>
            categories.map((category) =>
              category.id === id ? updated : category,
            ),
          ),
        ),
      );
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete(`/categories/${id}`, { silentErrors: true })
      .pipe(
        tap(() =>
          this.categoriesState.update((categories) =>
            categories.filter((category) => category.id !== id),
          ),
        ),
      );
  }

  // Excluye la categoría editada y sus descendientes para evitar ciclos.
  parentOptionsFor(categoryId: string | null): IndentedCategory[] {
    const categories = this.categoriesState();
    const excluded = categoryId
      ? collectSubtreeIds(categories, categoryId)
      : new Set<string>();
    return listCategoriesInTreeOrder(categories).filter(
      ({ category }) => !excluded.has(category.id),
    );
  }

  isExpanded(id: string): boolean {
    return this.expandedIdsState().has(id);
  }

  setExpanded(id: string, expanded: boolean): void {
    this.expandedIdsState.update((ids) => {
      const next = new Set(ids);
      if (expanded) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }
}
